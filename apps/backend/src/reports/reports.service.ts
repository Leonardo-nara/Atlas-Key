import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CashMovementType,
  CashRegisterSessionStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  SalePaymentMethod,
  SalePaymentStatus,
  SaleStatus,
  StockMovementDirection,
  StockMovementType
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { ReportListQueryDto, ReportOrigin, ReportPeriod, ReportPeriodQueryDto } from "./dto/report-query.dto";

const OPERATIONAL_TIMEZONE = "America/Sao_Paulo";
const MAX_PERIOD_DAYS = 366;
const EXPORT_LIMIT = 5000;
const DEFAULT_PAGE_LIMIT = 25;

type DateRange = {
  dateFrom: Date;
  dateToExclusive: Date;
  label: string;
};

type SaleSummaryRow = {
  id: string;
  friendlyId: string;
  origin: "PDV" | "DELIVERY";
  occurredAt: Date;
  customerName: string | null;
  soldAmount: number;
  paidAmount: number;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  operator: { id: string; name: string } | null;
  store: { id: string; name: string };
  cancelled: boolean;
  completed: boolean;
  estimated: boolean;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
  ) {}

  async overview(ownerUserId: string, role: UserRole, query: ReportPeriodQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const where = dateWhere(range);
    const [sales, orders, products, stockMovements, cashSessions] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: { storeId: store.id, createdAt: where },
        include: {
          payments: true,
          items: true
        }
      }),
      this.prisma.order.findMany({
        where: { storeId: store.id, createdAt: where },
        include: { items: true }
      }),
      this.prisma.product.findMany({ where: { storeId: store.id } }),
      this.prisma.stockMovement.findMany({
        where: { storeId: store.id, createdAt: where },
        include: { product: { select: { id: true, name: true } } }
      }),
      this.prisma.cashRegisterSession.findMany({
        where: { storeId: store.id, openedAt: where },
        include: { movements: true }
      })
    ]);

    const completedSales = sales.filter((sale) => sale.status === SaleStatus.COMPLETED);
    const cancelledSales = sales.filter((sale) => sale.status === SaleStatus.CANCELLED);
    const deliveredOrders = orders.filter((order) => order.status === OrderStatus.DELIVERED);
    const cancelledOrders = orders.filter((order) => order.status === OrderStatus.CANCELLED);
    const realizedCount = completedSales.length + deliveredOrders.length;
    const pdvSoldAmount = sum(completedSales.map((sale) => decimalToNumber(sale.total)));
    const deliverySoldAmount = sum(deliveredOrders.map((order) => decimalToNumber(order.total)));
    const soldAmount = pdvSoldAmount + deliverySoldAmount;
    const pdvPaidAmount = sum(completedSales.flatMap((sale) =>
      sale.payments.filter((payment) => payment.status === SalePaymentStatus.PAID).map((payment) => decimalToNumber(payment.amount))
    ));
    const deliveryPaidAmount = sum(deliveredOrders
      .filter((order) => order.paymentStatus === OrderPaymentStatus.PAID)
      .map((order) => decimalToNumber(order.total)));
    const paidAmount = pdvPaidAmount + deliveryPaidAmount;
    const pendingAmount = Math.max(0, soldAmount - paidAmount);
    const cancelledAmount = sum(cancelledSales.map((sale) => decimalToNumber(sale.total))) +
      sum(cancelledOrders.map((order) => decimalToNumber(order.total)));
    const rejectedAmount = sum(completedSales.flatMap((sale) =>
      sale.payments.filter((payment) => payment.status === SalePaymentStatus.FAILED).map((payment) => decimalToNumber(payment.amount))
    )) + sum(deliveredOrders
      .filter((order) => order.paymentStatus === OrderPaymentStatus.FAILED)
      .map((order) => decimalToNumber(order.total)));

    return {
      store: { id: store.id, name: store.name },
      period: serializeRange(range),
      generatedAt: new Date().toISOString(),
      sales: {
        soldAmount,
        paidAmount,
        pendingAmount,
        cancelledAmount,
        rejectedAmount,
        realizedCount,
        averageTicket: realizedCount === 0 ? 0 : roundMoney(soldAmount / realizedCount),
        deliverySoldAmount,
        pdvSoldAmount,
        cancelledCount: cancelledSales.length + cancelledOrders.length,
        byPaymentMethod: buildPaymentMethodBreakdown(completedSales, deliveredOrders, "sold"),
        paidByPaymentMethod: buildPaymentMethodBreakdown(completedSales, deliveredOrders, "paid")
      },
      operation: {
        deliveryOrdersCreated: orders.length,
        deliveryOrdersInProgress: orders.filter((order) =>
          order.status === OrderStatus.PENDING ||
          order.status === OrderStatus.ACCEPTED ||
          order.status === OrderStatus.ASSIGNED ||
          order.status === OrderStatus.OUT_FOR_DELIVERY
        ).length,
        deliveryOrdersDelivered: deliveredOrders.length,
        deliveryOrdersCancelled: cancelledOrders.length,
        pdvSalesCompleted: completedSales.length,
        pdvSalesCancelled: cancelledSales.length,
        openCashRegisters: cashSessions.filter((session) => session.status === CashRegisterSessionStatus.OPEN).length,
        closedCashRegisters: cashSessions.filter((session) => session.status === CashRegisterSessionStatus.CLOSED).length,
        closedCashDifferenceAmount: sum(cashSessions
          .filter((session) => session.status === CashRegisterSessionStatus.CLOSED && session.differenceAmount)
          .map((session) => decimalToNumber(session.differenceAmount)))
      },
      stock: {
        controlledProducts: products.filter((product) => product.stockControlEnabled).length,
        lowStockProducts: products.filter((product) => getStockStatus(product) === "LOW_STOCK").length,
        outOfStockProducts: products.filter((product) => getStockStatus(product) === "OUT_OF_STOCK").length,
        topSellingProducts: topProductsFromSales(completedSales, deliveredOrders),
        topPhysicalOutputProducts: topProductsFromMovements(stockMovements)
      }
    };
  }

  async sales(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;
    const take = skip + limit;
    const [saleRows, orderRows, saleCount, orderCount] = await this.fetchUnifiedSales(store.id, range, query, take);
    const merged = [...saleRows, ...orderRows]
      .sort((first, second) => second.occurredAt.getTime() - first.occurredAt.getTime());
    const items = merged.slice(skip, skip + limit);
    const total = saleCount + orderCount;

    return {
      items: items.map(serializeSaleRow),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async products(ownerUserId: string, role: UserRole, query: ReportPeriodQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const where = dateWhere(range);
    const [products, sales, orders] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" } }),
      this.prisma.sale.findMany({
        where: { storeId: store.id, status: SaleStatus.COMPLETED, completedAt: where },
        include: { items: true }
      }),
      this.prisma.order.findMany({
        where: { storeId: store.id, status: OrderStatus.DELIVERED, updatedAt: where },
        include: { items: true }
      })
    ]);
    const byProduct = new Map<string, {
      pdvQuantity: number;
      deliveryQuantity: number;
      soldAmount: number;
    }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        if (!item.productId) continue;
        const current = byProduct.get(item.productId) ?? { pdvQuantity: 0, deliveryQuantity: 0, soldAmount: 0 };
        current.pdvQuantity += item.quantity;
        current.soldAmount += decimalToNumber(item.total);
        byProduct.set(item.productId, current);
      }
    }

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const current = byProduct.get(item.productId) ?? { pdvQuantity: 0, deliveryQuantity: 0, soldAmount: 0 };
        current.deliveryQuantity += item.quantity;
        current.soldAmount += decimalToNumber(item.totalPrice);
        byProduct.set(item.productId, current);
      }
    }

    return {
      store: { id: store.id, name: store.name },
      period: serializeRange(range),
      items: products.map((product) => {
        const metrics = byProduct.get(product.id) ?? { pdvQuantity: 0, deliveryQuantity: 0, soldAmount: 0 };

        return {
          product: {
            id: product.id,
            name: product.name,
            category: product.category
          },
          sku: null,
          pdvQuantitySold: metrics.pdvQuantity,
          deliveryQuantitySold: metrics.deliveryQuantity,
          totalQuantitySold: metrics.pdvQuantity + metrics.deliveryQuantity,
          soldAmount: roundMoney(metrics.soldAmount),
          managerialRevenue: roundMoney(metrics.soldAmount),
          currentStock: decimalToNumber(product.stockQuantity),
          minimumStock: decimalToNumber(product.minimumStock),
          stockStatus: getStockStatus(product),
          estimated: false
        };
      })
    };
  }

  async payments(ownerUserId: string, role: UserRole, query: ReportPeriodQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const where = dateWhere(range);
    const [sales, orders] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: { storeId: store.id, status: SaleStatus.COMPLETED, completedAt: where },
        include: { payments: true }
      }),
      this.prisma.order.findMany({
        where: { storeId: store.id, status: OrderStatus.DELIVERED, updatedAt: where }
      })
    ]);
    const rows = new Map<string, {
      origin: "PDV" | "DELIVERY";
      paymentMethod: string;
      soldAmount: number;
      paidAmount: number;
      pendingAmount: number;
      rejectedAmount: number;
      cancelledAmount: number;
      transactionCount: number;
    }>();

    for (const sale of sales) {
      for (const payment of sale.payments) {
        addPaymentRow(rows, "PDV", payment.method, decimalToNumber(payment.amount), payment.status);
      }
    }

    for (const order of orders) {
      addPaymentRow(rows, "DELIVERY", order.paymentMethod, decimalToNumber(order.total), order.paymentStatus);
    }

    return {
      store: { id: store.id, name: store.name },
      period: serializeRange(range),
      items: [...rows.values()].map((row) => ({
        ...row,
        soldAmount: roundMoney(row.soldAmount),
        paidAmount: roundMoney(row.paidAmount),
        pendingAmount: roundMoney(row.pendingAmount),
        rejectedAmount: roundMoney(row.rejectedAmount),
        cancelledAmount: roundMoney(row.cancelledAmount)
      }))
    };
  }

  async cash(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const sessionStatus = optionalEnumValue(query.status, Object.values(CashRegisterSessionStatus), "status");
    const where: Prisma.CashRegisterSessionWhereInput = {
      storeId: store.id,
      openedAt: dateWhere(range),
      ...(sessionStatus ? { status: sessionStatus } : {})
    };
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.cashRegisterSession.findMany({
        where,
        include: {
          cashRegister: true,
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
          movements: true
        },
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.cashRegisterSession.count({ where })
    ]);

    return {
      items: sessions.map(serializeCashSession),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async stock(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const range = resolveDateRange(query);
    const products = await this.prisma.product.findMany({
      where: {
        storeId: store.id,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { category: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        stockMovements: {
          where: { createdAt: dateWhere(range) }
        }
      },
      orderBy: { name: "asc" }
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const filtered = products.filter((product) => {
      if (!query.status) return true;
      return getStockStatus(product) === query.status;
    });
    const paged = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: paged.map(serializeStockProduct),
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit))
    };
  }

  async salesCsv(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const rows = await this.sales(ownerUserId, role, { ...query, page: 1, limit: EXPORT_LIMIT });
    ensureExportLimit(rows.total);

    return buildCsv("relatorio-vendas", [
      ["Data", "Origem", "Cliente", "Status", "Forma de pagamento", "Status pagamento", "Total vendido", "Total pago"],
      ...rows.items.map((item) => [
        formatDatePtBr(item.occurredAt),
        item.origin,
        item.customerName ?? "",
        item.status,
        item.paymentMethod ?? "",
        item.paymentStatus,
        formatCsvMoney(item.soldAmount),
        formatCsvMoney(item.paidAmount)
      ])
    ]);
  }

  async productsCsv(ownerUserId: string, role: UserRole, query: ReportPeriodQueryDto) {
    const rows = await this.products(ownerUserId, role, query);
    ensureExportLimit(rows.items.length);

    return buildCsv("relatorio-produtos", [
      ["Produto", "Categoria", "Qtd. PDV", "Qtd. delivery", "Qtd. total", "Total vendido", "Saldo atual", "Estoque minimo", "Situacao"],
      ...rows.items.map((item) => [
        item.product.name,
        item.product.category,
        item.pdvQuantitySold,
        item.deliveryQuantitySold,
        item.totalQuantitySold,
        formatCsvMoney(item.soldAmount),
        item.currentStock,
        item.minimumStock,
        item.stockStatus
      ])
    ]);
  }

  async cashCsv(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const rows = await this.cash(ownerUserId, role, { ...query, page: 1, limit: EXPORT_LIMIT });
    ensureExportLimit(rows.total);

    return buildCsv("relatorio-caixa", [
      ["Caixa", "Status", "Operador", "Abertura", "Fechamento", "Saldo inicial", "Dinheiro vendido", "Reforcos", "Sangrias", "Esperado", "Contado", "Diferenca"],
      ...rows.items.map((item) => [
        item.cashRegister.name,
        item.status,
        item.openedBy?.name ?? "",
        formatDatePtBr(item.openedAt),
        item.closedAt ? formatDatePtBr(item.closedAt) : "",
        formatCsvMoney(item.openingAmount),
        formatCsvMoney(item.cashSalesAmount),
        formatCsvMoney(item.cashInAmount),
        formatCsvMoney(item.cashOutAmount),
        formatCsvMoney(item.expectedCashAmount),
        item.countedCashAmount === null ? "" : formatCsvMoney(item.countedCashAmount),
        item.differenceAmount === null ? "" : formatCsvMoney(item.differenceAmount)
      ])
    ]);
  }

  async stockCsv(ownerUserId: string, role: UserRole, query: ReportListQueryDto) {
    const rows = await this.stock(ownerUserId, role, { ...query, page: 1, limit: EXPORT_LIMIT });
    ensureExportLimit(rows.total);

    return buildCsv("relatorio-estoque", [
      ["Produto", "Situacao", "Saldo atual", "Estoque minimo", "Entradas", "Saidas", "Ajustes", "Reservas", "Liberacoes", "Baixas PDV", "Movimento liquido"],
      ...rows.items.map((item) => [
        item.product.name,
        item.stockStatus,
        item.currentStock,
        item.minimumStock,
        item.entries,
        item.outputs,
        item.adjustments,
        item.deliveryReservations,
        item.deliveryReleases,
        item.pdvOutputs,
        item.netMovement
      ])
    ]);
  }

  private async fetchUnifiedSales(
    storeId: string,
    range: DateRange,
    query: ReportListQueryDto,
    take: number
  ): Promise<[SaleSummaryRow[], SaleSummaryRow[], number, number]> {
    const search = query.search?.trim();
    const saleStatus = optionalLooseEnumValue(query.status, Object.values(SaleStatus));
    const orderStatus = optionalLooseEnumValue(query.status, Object.values(OrderStatus));
    const salePaymentStatus = optionalLooseEnumValue(query.paymentStatus, Object.values(SalePaymentStatus));
    const orderPaymentStatus = optionalLooseEnumValue(query.paymentStatus, Object.values(OrderPaymentStatus));
    const salePaymentMethod = optionalLooseEnumValue(query.paymentMethod, Object.values(SalePaymentMethod));
    const orderPaymentMethod = optionalLooseEnumValue(query.paymentMethod, Object.values(OrderPaymentMethod));

    if (query.status && !saleStatus && !orderStatus) {
      throw new BadRequestException("Filtro de status invalido.");
    }
    if (query.paymentStatus && !salePaymentStatus && !orderPaymentStatus) {
      throw new BadRequestException("Filtro de status de pagamento invalido.");
    }
    if (query.paymentMethod && !salePaymentMethod && !orderPaymentMethod) {
      throw new BadRequestException("Filtro de forma de pagamento invalido.");
    }

    const saleWhere: Prisma.SaleWhereInput = {
      storeId,
      createdAt: dateWhere(range),
      ...(query.origin === ReportOrigin.DELIVERY ? { id: "__never__" } : {}),
      ...(query.status && !saleStatus ? { id: "__never__" } : {}),
      ...(saleStatus ? { status: saleStatus } : {}),
      ...(query.paymentStatus && !salePaymentStatus ? { id: "__never__" } : {}),
      ...(query.paymentMethod && !salePaymentMethod ? { id: "__never__" } : {}),
      ...(salePaymentStatus ? { payments: { some: { status: salePaymentStatus } } } : {}),
      ...(salePaymentMethod ? { payments: { some: { method: salePaymentMethod } } } : {}),
      ...(search ? { OR: [{ id: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }] } : {})
    };
    const orderWhere: Prisma.OrderWhereInput = {
      storeId,
      createdAt: dateWhere(range),
      ...(query.origin === ReportOrigin.PDV ? { id: "__never__" } : {}),
      ...(query.status && !orderStatus ? { id: "__never__" } : {}),
      ...(orderStatus ? { status: orderStatus } : {}),
      ...(query.paymentStatus && !orderPaymentStatus ? { id: "__never__" } : {}),
      ...(query.paymentMethod && !orderPaymentMethod ? { id: "__never__" } : {}),
      ...(orderPaymentStatus ? { paymentStatus: orderPaymentStatus } : {}),
      ...(orderPaymentMethod ? { paymentMethod: orderPaymentMethod } : {}),
      ...(search ? { OR: [{ id: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }, { customerPhone: { contains: search, mode: "insensitive" } }] } : {})
    };
    const [sales, orders, saleCount, orderCount] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: saleWhere,
        include: {
          store: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          payments: true
        },
        orderBy: { createdAt: "desc" },
        take
      }),
      this.prisma.order.findMany({
        where: orderWhere,
        include: { store: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take
      }),
      this.prisma.sale.count({ where: saleWhere }),
      this.prisma.order.count({ where: orderWhere })
    ]);

    const saleRows = sales
      .map((sale) => {
        const paidAmount = sum(sale.payments
          .filter((payment) => payment.status === SalePaymentStatus.PAID)
          .map((payment) => decimalToNumber(payment.amount)));
        return {
          id: sale.id,
          friendlyId: shortId(sale.id),
          origin: "PDV" as const,
          occurredAt: sale.completedAt ?? sale.createdAt,
          customerName: sale.customerName,
          soldAmount: sale.status === SaleStatus.COMPLETED ? decimalToNumber(sale.total) : 0,
          paidAmount,
          status: sale.status,
          paymentMethod: sale.payments.map((payment) => payment.method).join(", ") || null,
          paymentStatus: sale.paymentStatus,
          operator: sale.operator,
          store: sale.store,
          cancelled: sale.status === SaleStatus.CANCELLED,
          completed: sale.status === SaleStatus.COMPLETED,
          estimated: false
        };
      });
    const orderRows = orders.map((order) => {
      const sold = order.status === OrderStatus.DELIVERED ? decimalToNumber(order.total) : 0;
      return {
        id: order.id,
        friendlyId: shortId(order.id),
        origin: "DELIVERY" as const,
        occurredAt: order.updatedAt ?? order.createdAt,
        customerName: order.customerName,
        soldAmount: sold,
        paidAmount: order.paymentStatus === OrderPaymentStatus.PAID ? sold : 0,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        operator: null,
        store: order.store,
        cancelled: order.status === OrderStatus.CANCELLED,
        completed: order.status === OrderStatus.DELIVERED,
        estimated: false
      };
    });

    return [saleRows, orderRows, saleCount, orderCount];
  }
}

function resolveDateRange(query: ReportPeriodQueryDto): DateRange {
  const period = query.period ?? ReportPeriod.TODAY;
  const nowParts = getZonedDateParts(new Date());
  let fromParts = nowParts;
  let toParts = addDays(nowParts, 1);

  if (period === ReportPeriod.YESTERDAY) {
    fromParts = addDays(nowParts, -1);
    toParts = nowParts;
  } else if (period === ReportPeriod.SEVEN_DAYS) {
    fromParts = addDays(nowParts, -6);
    toParts = addDays(nowParts, 1);
  } else if (period === ReportPeriod.THIRTY_DAYS) {
    fromParts = addDays(nowParts, -29);
    toParts = addDays(nowParts, 1);
  } else if (period === ReportPeriod.CURRENT_MONTH) {
    fromParts = { year: nowParts.year, month: nowParts.month, day: 1 };
    toParts = nowParts.month === 12
      ? { year: nowParts.year + 1, month: 1, day: 1 }
      : { year: nowParts.year, month: nowParts.month + 1, day: 1 };
  } else if (period === ReportPeriod.CUSTOM) {
    if (!query.dateFrom || !query.dateTo) {
      throw new BadRequestException("dateFrom e dateTo sao obrigatorios para periodo personalizado");
    }
    fromParts = parseDateInput(query.dateFrom);
    toParts = addDays(parseDateInput(query.dateTo), 1);
  }

  const dateFrom = zonedDateStartToUtc(fromParts);
  const dateToExclusive = zonedDateStartToUtc(toParts);
  const days = Math.ceil((dateToExclusive.getTime() - dateFrom.getTime()) / 86_400_000);

  if (dateFrom >= dateToExclusive) {
    throw new BadRequestException("dateFrom nao pode ser posterior a dateTo");
  }

  if (days > MAX_PERIOD_DAYS) {
    throw new BadRequestException("Periodo maximo permitido para relatorios e de 366 dias");
  }

  return {
    dateFrom,
    dateToExclusive,
    label: period
  };
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    throw new BadRequestException("Datas devem estar em formato ISO valido");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException("Datas devem estar em formato ISO valido");
  }

  return { year, month, day };
}

function getZonedDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function zonedDateStartToUtc(parts: { year: number; month: number; day: number }) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 3, 0, 0, 0));
  return utc;
}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function dateWhere(range: DateRange) {
  return { gte: range.dateFrom, lt: range.dateToExclusive };
}

function serializeRange(range: DateRange) {
  return {
    label: range.label,
    timezone: OPERATIONAL_TIMEZONE,
    dateFrom: range.dateFrom.toISOString(),
    dateToExclusive: range.dateToExclusive.toISOString()
  };
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function sum(values: number[]) {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildPaymentMethodBreakdown(
  sales: Array<{ total: Prisma.Decimal; payments: Array<{ method: SalePaymentMethod; amount: Prisma.Decimal; status: SalePaymentStatus }> }>,
  orders: Array<{ total: Prisma.Decimal; paymentMethod: OrderPaymentMethod; paymentStatus: OrderPaymentStatus }>,
  mode: "sold" | "paid"
) {
  const rows = new Map<string, { method: string; amount: number; count: number }>();

  for (const sale of sales) {
    for (const payment of sale.payments) {
      if (mode === "paid" && payment.status !== SalePaymentStatus.PAID) continue;
      addBreakdown(rows, payment.method, decimalToNumber(payment.amount));
    }
  }

  for (const order of orders) {
    if (mode === "paid" && order.paymentStatus !== OrderPaymentStatus.PAID) continue;
    addBreakdown(rows, order.paymentMethod, decimalToNumber(order.total));
  }

  return [...rows.values()];
}

function addBreakdown(rows: Map<string, { method: string; amount: number; count: number }>, method: string, amount: number) {
  const current = rows.get(method) ?? { method, amount: 0, count: 0 };
  current.amount = roundMoney(current.amount + amount);
  current.count += 1;
  rows.set(method, current);
}

function topProductsFromSales(
  sales: Array<{ items: Array<{ productId: string | null; productNameSnapshot: string; quantity: number; total: Prisma.Decimal }> }>,
  orders: Array<{ items: Array<{ productId: string | null; nameSnapshot: string; quantity: number; totalPrice: Prisma.Decimal }> }>
) {
  const rows = new Map<string, { productId: string | null; name: string; quantitySold: number; soldAmount: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      addProductRow(rows, item.productId, item.productNameSnapshot, item.quantity, decimalToNumber(item.total));
    }
  }
  for (const order of orders) {
    for (const item of order.items) {
      addProductRow(rows, item.productId, item.nameSnapshot, item.quantity, decimalToNumber(item.totalPrice));
    }
  }
  return [...rows.values()].sort((first, second) => second.quantitySold - first.quantitySold).slice(0, 5);
}

function addProductRow(
  rows: Map<string, { productId: string | null; name: string; quantitySold: number; soldAmount: number }>,
  productId: string | null,
  name: string,
  quantity: number,
  amount: number
) {
  const key = productId ?? name;
  const current = rows.get(key) ?? { productId, name, quantitySold: 0, soldAmount: 0 };
  current.quantitySold += quantity;
  current.soldAmount = roundMoney(current.soldAmount + amount);
  rows.set(key, current);
}

function topProductsFromMovements(
  movements: Array<{ productId: string; product: { id: string; name: string }; direction: StockMovementDirection; quantity: Prisma.Decimal; type: StockMovementType }>
) {
  const rows = new Map<string, { productId: string; name: string; quantityMoved: number }>();
  for (const movement of movements) {
    if (movement.direction !== StockMovementDirection.OUT || movement.type === StockMovementType.DELIVERY_RESERVED) continue;
    const current = rows.get(movement.productId) ?? {
      productId: movement.productId,
      name: movement.product.name,
      quantityMoved: 0
    };
    current.quantityMoved += decimalToNumber(movement.quantity);
    rows.set(movement.productId, current);
  }
  return [...rows.values()].sort((first, second) => second.quantityMoved - first.quantityMoved).slice(0, 5);
}

function getStockStatus(product: { stockControlEnabled: boolean; stockQuantity: Prisma.Decimal; minimumStock: Prisma.Decimal }) {
  if (!product.stockControlEnabled) return "NO_CONTROL";
  if (product.stockQuantity.lessThanOrEqualTo(0)) return "OUT_OF_STOCK";
  if (product.stockQuantity.lessThanOrEqualTo(product.minimumStock)) return "LOW_STOCK";
  return "IN_STOCK";
}

function addPaymentRow(
  rows: Map<string, { origin: "PDV" | "DELIVERY"; paymentMethod: string; soldAmount: number; paidAmount: number; pendingAmount: number; rejectedAmount: number; cancelledAmount: number; transactionCount: number }>,
  origin: "PDV" | "DELIVERY",
  paymentMethod: string,
  amount: number,
  status: SalePaymentStatus | OrderPaymentStatus
) {
  const key = `${origin}:${paymentMethod}`;
  const row = rows.get(key) ?? {
    origin,
    paymentMethod,
    soldAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    rejectedAmount: 0,
    cancelledAmount: 0,
    transactionCount: 0
  };
  row.soldAmount += amount;
  row.transactionCount += 1;
  if (status === "PAID") row.paidAmount += amount;
  if (status === "PENDING") row.pendingAmount += amount;
  if (status === "FAILED") row.rejectedAmount += amount;
  if (status === "CANCELLED") row.cancelledAmount += amount;
  rows.set(key, row);
}

function serializeSaleRow(row: SaleSummaryRow) {
  return {
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    soldAmount: roundMoney(row.soldAmount),
    paidAmount: roundMoney(row.paidAmount)
  };
}

function serializeCashSession(session: {
  id: string;
  status: CashRegisterSessionStatus;
  openingAmount: Prisma.Decimal;
  expectedCashAmount: Prisma.Decimal;
  countedCashAmount: Prisma.Decimal | null;
  differenceAmount: Prisma.Decimal | null;
  openingNotes: string | null;
  closingNotes: string | null;
  openedAt: Date;
  closedAt: Date | null;
  cashRegister: { id: string; name: string };
  openedBy: { id: string; name: string };
  closedBy: { id: string; name: string } | null;
  movements: Array<{ type: CashMovementType; amount: Prisma.Decimal }>;
}) {
  const cashSalesAmount = sum(session.movements
    .filter((movement) => movement.type === CashMovementType.SALE)
    .map((movement) => decimalToNumber(movement.amount)));
  const cashInAmount = sum(session.movements
    .filter((movement) => movement.type === CashMovementType.CASH_IN)
    .map((movement) => decimalToNumber(movement.amount)));
  const cashOutAmount = sum(session.movements
    .filter((movement) => movement.type === CashMovementType.CASH_OUT)
    .map((movement) => decimalToNumber(movement.amount)));

  return {
    id: session.id,
    status: session.status,
    cashRegister: session.cashRegister,
    openedBy: session.openedBy,
    closedBy: session.closedBy,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    openingAmount: decimalToNumber(session.openingAmount),
    cashSalesAmount,
    cashInAmount,
    cashOutAmount,
    expectedCashAmount: decimalToNumber(session.expectedCashAmount),
    countedCashAmount: session.countedCashAmount ? decimalToNumber(session.countedCashAmount) : null,
    differenceAmount: session.countedCashAmount ? decimalToNumber(session.differenceAmount) : null,
    openingNotes: session.openingNotes,
    closingNotes: session.closingNotes
  };
}

function serializeStockProduct(product: {
  id: string;
  name: string;
  category: string;
  stockControlEnabled: boolean;
  stockQuantity: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
  stockMovements: Array<{ type: StockMovementType; direction: StockMovementDirection; quantity: Prisma.Decimal }>;
}) {
  const quantityByType = (type: StockMovementType) => sum(product.stockMovements
    .filter((movement) => movement.type === type)
    .map((movement) => decimalToNumber(movement.quantity)));
  const entries = sum(product.stockMovements
    .filter((movement) => movement.direction === StockMovementDirection.IN)
    .map((movement) => decimalToNumber(movement.quantity)));
  const outputs = sum(product.stockMovements
    .filter((movement) => movement.direction === StockMovementDirection.OUT)
    .map((movement) => decimalToNumber(movement.quantity)));

  return {
    product: { id: product.id, name: product.name, category: product.category },
    stockControlEnabled: product.stockControlEnabled,
    currentStock: decimalToNumber(product.stockQuantity),
    minimumStock: decimalToNumber(product.minimumStock),
    stockStatus: getStockStatus(product),
    entries,
    outputs,
    adjustments: quantityByType(StockMovementType.INVENTORY_ADJUSTMENT),
    deliveryReservations: quantityByType(StockMovementType.DELIVERY_RESERVED),
    deliveryReleases: quantityByType(StockMovementType.DELIVERY_RELEASED),
    pdvOutputs: quantityByType(StockMovementType.PDV_SALE),
    deliveryOutputs: 0,
    netMovement: roundMoney(entries - outputs)
  };
}

function optionalEnumValue<T extends string>(value: string | undefined, allowed: T[], label: string): T | undefined {
  if (!value) return undefined;
  if (allowed.includes(value as T)) return value as T;
  throw new BadRequestException(`Filtro de ${label} invalido.`);
}

function optionalLooseEnumValue<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? value as T : undefined;
}

function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

function buildCsv(filePrefix: string, rows: Array<Array<string | number | null>>) {
  const content = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}`;

  return {
    fileName: `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`,
    content
  };
}

function escapeCsvCell(value: string | number | null) {
  const raw = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function ensureExportLimit(total: number) {
  if (total > EXPORT_LIMIT) {
    throw new BadRequestException(`Exportacao limitada a ${EXPORT_LIMIT} linhas. Reduza os filtros do periodo.`);
  }
}

function formatDatePtBr(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: OPERATIONAL_TIMEZONE
  }).format(new Date(value));
}

function formatCsvMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}
