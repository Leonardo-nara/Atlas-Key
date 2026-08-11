import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

import { UserRole } from "../src/common/enums/user-role.enum";
import { ReportOrigin, ReportPeriod } from "../src/reports/dto/report-query.dto";
import { ReportsService } from "../src/reports/reports.service";

type StoreId = "store-a" | "store-b";

const ownerByStore: Record<string, StoreId> = {
  "owner-a": "store-a",
  "owner-b": "store-b"
};

describe("reports service calculations", () => {
  it("calcula venda realizada, pago, pendente e ticket medio sem contar draft/cancelado/andamento", async () => {
    const service = createReportsService();
    const overview = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });

    assert.equal(overview.sales.soldAmount, 180);
    assert.equal(overview.sales.paidAmount, 150);
    assert.equal(overview.sales.pendingAmount, 30);
    assert.equal(overview.sales.realizedCount, 2);
    assert.equal(overview.sales.averageTicket, 90);
    assert.equal(overview.sales.pdvSoldAmount, 100);
    assert.equal(overview.sales.deliverySoldAmount, 80);
    assert.equal(overview.sales.cancelledAmount, 80);
    assert.equal(overview.operation.deliveryOrdersInProgress, 1);
  });

  it("retorna ticket medio zero quando nao ha venda realizada no periodo", async () => {
    const service = createReportsService();
    const overview = await service.overview("owner-a", UserRole.STORE_ADMIN, {
      period: ReportPeriod.CUSTOM,
      dateFrom: "2020-01-01",
      dateTo: "2020-01-01"
    });

    assert.equal(overview.sales.soldAmount, 0);
    assert.equal(overview.sales.realizedCount, 0);
    assert.equal(overview.sales.averageTicket, 0);
  });

  it("separa PDV e delivery e preserva CASH, CARD, CARD_ON_DELIVERY e PIX_MANUAL sem inventar ONLINE no PDV", async () => {
    const service = createReportsService();
    const payments = await service.payments("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const keys = payments.items.map((item) => `${item.origin}:${item.paymentMethod}`).sort();

    assert.deepEqual(keys, ["DELIVERY:CARD_ON_DELIVERY", "PDV:CARD", "PDV:CASH"]);
    assert.equal(keys.some((key) => key === "PDV:ONLINE"), false);
    assert.equal(payments.items.find((item) => item.origin === "PDV" && item.paymentMethod === "CASH")?.paidAmount, 70);
    assert.equal(payments.items.find((item) => item.origin === "PDV" && item.paymentMethod === "CARD")?.pendingAmount, 30);
    assert.equal(payments.items.find((item) => item.origin === "DELIVERY" && item.paymentMethod === "CARD_ON_DELIVERY")?.paidAmount, 80);
  });

  it("lista vendas paginadas em ordem decrescente e respeita filtros principais", async () => {
    const service = createReportsService();
    const firstPage = await service.sales("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const deliveryOnly = await service.sales("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY, origin: ReportOrigin.DELIVERY });
    const pdvPaidCash = await service.sales("owner-a", UserRole.STORE_ADMIN, {
      period: ReportPeriod.TODAY,
      origin: ReportOrigin.PDV,
      status: SaleStatus.COMPLETED,
      paymentMethod: SalePaymentMethod.CASH,
      paymentStatus: SalePaymentStatus.PAID
    });

    assert.equal(firstPage.limit, 25);
    assert.equal(firstPage.total, 6);
    assert.equal(firstPage.items[0].occurredAt >= firstPage.items[1].occurredAt, true);
    assert.equal(deliveryOnly.items.every((item) => item.origin === "DELIVERY"), true);
    assert.equal(pdvPaidCash.total, 1);
    assert.equal(pdvPaidCash.items[0].soldAmount, 100);
  });

  it("usa snapshots de preco e nome para produtos vendidos", async () => {
    const service = createReportsService();
    const products = await service.products("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const burger = products.items.find((item) => item.product.id === "product-a-1");

    assert.ok(burger);
    assert.equal(burger.product.name, "Produto atual A");
    assert.equal(burger.pdvQuantitySold, 2);
    assert.equal(burger.deliveryQuantitySold, 1);
    assert.equal(burger.totalQuantitySold, 3);
    assert.equal(burger.soldAmount, 180);
  });

  it("nao conta estoque reservado como venda nem duplica saidas fisicas", async () => {
    const service = createReportsService();
    const overview = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const stock = await service.stock("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const product = stock.items.find((item) => item.product.id === "product-a-1");

    assert.equal(overview.stock.topPhysicalOutputProducts[0].quantityMoved, 7);
    assert.ok(product);
    assert.equal(product.deliveryReservations, 99);
    assert.equal(product.pdvOutputs, 2);
    assert.equal(product.outputs, 106);
    assert.equal(product.netMovement, -85);
  });

  it("calcula caixa esperado, contado, diferenca e caixa aberto sem diferenca", async () => {
    const service = createReportsService();
    const overview = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const cash = await service.cash("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const closed = cash.items.find((item) => item.id === "cash-session-closed-a");
    const open = cash.items.find((item) => item.id === "cash-session-open-a");

    assert.equal(overview.operation.closedCashDifferenceAmount, -5);
    assert.ok(closed);
    assert.equal(closed.openingAmount, 20);
    assert.equal(closed.cashSalesAmount, 100);
    assert.equal(closed.cashInAmount, 10);
    assert.equal(closed.cashOutAmount, 15);
    assert.equal(closed.expectedCashAmount, 115);
    assert.equal(closed.countedCashAmount, 110);
    assert.equal(closed.differenceAmount, -5);
    assert.ok(open);
    assert.equal(open.differenceAmount, null);
  });

  it("resolve periodos hoje, ontem, 7 dias, 30 dias, mes atual e custom valido", async () => {
    const service = createReportsService();
    const today = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const yesterday = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.YESTERDAY });
    const sevenDays = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.SEVEN_DAYS });
    const thirtyDays = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.THIRTY_DAYS });
    const currentMonth = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.CURRENT_MONTH });
    const todayDate = atLocalNoon(new Date());
    const custom = await service.overview("owner-a", UserRole.STORE_ADMIN, {
      period: ReportPeriod.CUSTOM,
      dateFrom: isoDate(addDays(todayDate, -1)),
      dateTo: isoDate(todayDate)
    });

    assert.equal(today.sales.soldAmount, 180);
    assert.equal(yesterday.sales.soldAmount, 60);
    assert.equal(sevenDays.sales.soldAmount >= 240, true);
    assert.equal(thirtyDays.sales.soldAmount >= sevenDays.sales.soldAmount, true);
    assert.equal(currentMonth.period.timezone, "America/Sao_Paulo");
    assert.equal(custom.sales.soldAmount >= 240, true);
  });

  it("usa o timezone da loja para fechar periodos que atravessam meia-noite", async () => {
    const service = createReportsService();
    const overview = await service.overview("owner-b", UserRole.STORE_ADMIN, {
      period: ReportPeriod.CUSTOM,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-01"
    });

    assert.equal(overview.period.timezone, "America/Rio_Branco");
    assert.equal(overview.sales.deliverySoldAmount, 55);
  });

  it("rejeita custom invalido, invertido e periodo acima de 366 dias", async () => {
    const service = createReportsService();

    await assert.rejects(
      () => service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.CUSTOM, dateFrom: "invalida", dateTo: "2026-01-01" }),
      /Datas devem estar em formato ISO valido/
    );
    await assert.rejects(
      () => service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.CUSTOM, dateFrom: "2026-02-01", dateTo: "2026-01-01" }),
      /dateFrom nao pode ser posterior a dateTo/
    );
    await assert.rejects(
      () => service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.CUSTOM, dateFrom: "2025-01-01", dateTo: "2026-12-31" }),
      /Periodo maximo/
    );
  });

  it("limita pagina em 100 via DTO e pagina no banco para endpoints listaveis", async () => {
    const service = createReportsService();
    const sales = await service.sales("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY, page: 1, limit: 100 });
    const stock = await service.stock("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY, page: 1, limit: 100 });

    assert.equal(sales.limit, 100);
    assert.equal(sales.totalPages, 1);
    assert.equal(stock.limit, 100);
  });

  it("isola dados da loja A e nao retorna dados da loja B em relatorios ou CSV", async () => {
    const service = createReportsService();
    const overviewA = await service.overview("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const overviewB = await service.overview("owner-b", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const csvA = await service.salesCsv("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });

    assert.equal(overviewA.sales.soldAmount, 180);
    assert.equal(overviewB.sales.soldAmount, 77);
    assert.equal(csvA.content.includes("Cliente loja B"), false);
  });

  it("gera CSV UTF-8 com BOM, cabecalho, headers esperados e aspas escapadas", async () => {
    const service = createReportsService();
    const csv = await service.salesCsv("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });

    assert.equal(csv.content.charCodeAt(0), 0xFEFF);
    assert.equal(csv.fileName.startsWith("relatorio-vendas-"), true);
    assert.equal(csv.content.includes("\"Data\";\"Origem\";\"Cliente\""), true);
    assert.equal(csv.content.includes("\"Cliente \"\"com aspas\"\"\""), true);
  });

  it("neutraliza formulas CSV iniciadas por =, +, -, @, tab, CR e LF", async () => {
    const service = createReportsService();
    const csv = await service.salesCsv("owner-b", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });

    assert.equal(csv.content.includes("\"'=formula\""), true);
    assert.equal(csv.content.includes("\"'+formula\""), true);
    assert.equal(csv.content.includes("\"'-formula\""), true);
    assert.equal(csv.content.includes("\"'@formula\""), true);
    assert.equal(csv.content.includes("\"'\tformula\""), true);
    assert.equal(csv.content.includes("\"'\rformula\""), true);
    assert.equal(csv.content.includes("\"'\nformula\""), true);
  });

  it("preserva regressoes de delivery, PDV, caixa, estoque e Pix manual no escopo gerencial", async () => {
    const service = createReportsService();
    const sales = await service.sales("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const cash = await service.cash("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });
    const stock = await service.stock("owner-a", UserRole.STORE_ADMIN, { period: ReportPeriod.TODAY });

    assert.equal(sales.items.some((item) => item.origin === "DELIVERY" && item.paymentMethod === OrderPaymentMethod.PIX_MANUAL), true);
    assert.equal(sales.items.some((item) => item.origin === "PDV" && item.status === SaleStatus.COMPLETED), true);
    assert.equal(cash.items.length, 2);
    assert.equal(stock.items.some((item) => item.stockStatus === "LOW_STOCK"), true);
  });
});

function createReportsService() {
  const fixture = buildFixture();
  const prisma = createPrismaMock(fixture);
  const storesService = {
    getStoreByOwner: (ownerUserId: string) => {
      const storeId = ownerByStore[ownerUserId];
      const store = fixture.stores.find((item) => item.id === storeId);
      assert.ok(store);
      return store;
    }
  };

  return new ReportsService(prisma as never, storesService as never);
}

function buildFixture() {
  const today = atLocalNoon(new Date());
  const todayStoreB = atLocalNoon(new Date(), "America/Rio_Branco");
  const yesterday = addDays(today, -1);
  const old = addDays(today, -40);
  const stores = [
    { id: "store-a", name: "QA_REPORTS_STORE_A", timezone: "America/Sao_Paulo" },
    { id: "store-b", name: "QA_REPORTS_STORE_B", timezone: "America/Rio_Branco" }
  ];
  const products = [
    product("product-a-1", "store-a", "Produto atual A", "Categoria", 4, 5, true),
    product("product-a-2", "store-a", "Produto sem controle", "Categoria", 0, 0, false),
    product("product-b-1", "store-b", "Produto loja B", "Categoria", 10, 1, true)
  ];
  const sales = [
    sale("sale-a-completed", "store-a", "Cliente \"com aspas\"", SaleStatus.COMPLETED, 100, today, today, [
      payment(SalePaymentMethod.CASH, SalePaymentStatus.PAID, 70),
      payment(SalePaymentMethod.CARD, SalePaymentStatus.PENDING, 30)
    ], [saleItem("product-a-1", "=Snapshot PDV", 2, 50, 100)]),
    sale("sale-a-draft", "store-a", "Cliente draft", SaleStatus.DRAFT, 50, today, null, [
      payment(SalePaymentMethod.CASH, SalePaymentStatus.PENDING, 50)
    ], [saleItem("product-a-1", "Draft", 1, 50, 50)]),
    sale("sale-a-cancelled", "store-a", "Cliente cancelado", SaleStatus.CANCELLED, 40, today, null, [
      payment(SalePaymentMethod.CASH, SalePaymentStatus.CANCELLED, 40)
    ], [saleItem("product-a-1", "Cancelado", 1, 40, 40)]),
    sale("sale-a-yesterday", "store-a", "Cliente ontem", SaleStatus.COMPLETED, 60, yesterday, yesterday, [
      payment(SalePaymentMethod.CASH, SalePaymentStatus.PAID, 60)
    ], [saleItem("product-a-1", "Ontem", 1, 60, 60)]),
    sale("sale-a-old", "store-a", "Cliente antigo", SaleStatus.COMPLETED, 25, old, old, [
      payment(SalePaymentMethod.CASH, SalePaymentStatus.PAID, 25)
    ], [saleItem("product-a-1", "Antigo", 1, 25, 25)]),
    ...["=formula", "+formula", "-formula", "@formula", "\tformula", "\rformula", "\nformula"].map((name, index) =>
      sale(`sale-b-${index}`, "store-b", name, SaleStatus.COMPLETED, index === 0 ? 33 : 0, todayStoreB, todayStoreB, [
        payment(SalePaymentMethod.CASH, SalePaymentStatus.PAID, index === 0 ? 33 : 0)
      ], [saleItem("product-b-1", name, 1, index === 0 ? 33 : 0, index === 0 ? 33 : 0)])
    )
  ];
  const orders = [
    order("order-a-delivered", "store-a", "Cliente delivery", OrderStatus.DELIVERED, OrderPaymentMethod.CARD_ON_DELIVERY, OrderPaymentStatus.PAID, 80, today, today, [
      orderItem("product-a-1", "+Snapshot Delivery", 1, 80, 80)
    ]),
    order("order-a-cancelled", "store-a", "Cliente delivery cancelado", OrderStatus.CANCELLED, OrderPaymentMethod.PIX_MANUAL, OrderPaymentStatus.CANCELLED, 40, today, today, [
      orderItem("product-a-1", "Cancelado", 1, 40, 40)
    ]),
    order("order-a-progress", "store-a", "Cliente andamento", OrderStatus.ACCEPTED, OrderPaymentMethod.PIX_MANUAL, OrderPaymentStatus.PENDING, 60, today, today, [
      orderItem("product-a-1", "Andamento", 1, 60, 60)
    ]),
    order("order-b-delivered", "store-b", "Cliente loja B", OrderStatus.DELIVERED, OrderPaymentMethod.PIX_MANUAL, OrderPaymentStatus.PAID, 44, todayStoreB, todayStoreB, [
      orderItem("product-b-1", "Loja B", 1, 44, 44)
    ]),
    order("order-b-rio-branco-edge", "store-b", "Cliente fuso", OrderStatus.DELIVERED, OrderPaymentMethod.CASH, OrderPaymentStatus.PAID, 55, new Date("2026-01-02T04:30:00.000Z"), new Date("2026-01-02T04:30:00.000Z"), [
      orderItem("product-b-1", "Fuso", 1, 55, 55)
    ])
  ];
  const cashSessions = [
    cashSession("cash-session-closed-a", "store-a", CashRegisterSessionStatus.CLOSED, today, 20, 115, 110, -5, [
      cashMovement(CashMovementType.SALE, 100),
      cashMovement(CashMovementType.CASH_IN, 10),
      cashMovement(CashMovementType.CASH_OUT, 15)
    ]),
    cashSession("cash-session-open-a", "store-a", CashRegisterSessionStatus.OPEN, today, 10, 10, null, null, [])
  ];
  const stockMovements = [
    stockMovement("store-a", "product-a-1", today, StockMovementType.PURCHASE_ENTRY, StockMovementDirection.IN, 20),
    stockMovement("store-a", "product-a-1", today, StockMovementType.PDV_SALE, StockMovementDirection.OUT, 2),
    stockMovement("store-a", "product-a-1", today, StockMovementType.MANUAL_EXIT, StockMovementDirection.OUT, 5),
    stockMovement("store-a", "product-a-1", today, StockMovementType.DELIVERY_RESERVED, StockMovementDirection.OUT, 99),
    stockMovement("store-a", "product-a-1", today, StockMovementType.DELIVERY_RELEASED, StockMovementDirection.IN, 1)
  ];

  return { stores, products, sales, orders, cashSessions, stockMovements };
}

function createPrismaMock(fixture: ReturnType<typeof buildFixture>) {
  return {
    $transaction: async (queries: Array<Promise<unknown>>) => Promise.all(queries),
    sale: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number; skip?: number }) =>
        applyPaging(fixture.sales.filter((item) => matchesWhere(item, args.where)), args),
      count: async (args: { where?: Record<string, unknown> }) => fixture.sales.filter((item) => matchesWhere(item, args.where)).length
    },
    order: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number; skip?: number }) =>
        applyPaging(fixture.orders.filter((item) => matchesWhere(item, args.where)), args),
      count: async (args: { where?: Record<string, unknown> }) => fixture.orders.filter((item) => matchesWhere(item, args.where)).length
    },
    product: {
      findMany: async (args: { where?: Record<string, unknown> }) => fixture.products
        .filter((item) => matchesWhere(item, args.where))
        .map((item) => ({
          ...item,
          stockMovements: fixture.stockMovements.filter((movement) => movement.productId === item.id && matchesDate(movement.createdAt, args.where?.["stockMovements"]))
        }))
    },
    stockMovement: {
      findMany: async (args: { where?: Record<string, unknown> }) => fixture.stockMovements
        .filter((item) => matchesWhere(item, args.where))
        .map((item) => ({ ...item, product: fixture.products.find((productRow) => productRow.id === item.productId)! }))
    },
    cashRegisterSession: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number; skip?: number }) =>
        applyPaging(fixture.cashSessions.filter((item) => matchesWhere(item, args.where)), args),
      count: async (args: { where?: Record<string, unknown> }) => fixture.cashSessions.filter((item) => matchesWhere(item, args.where)).length
    }
  };
}

function matchesWhere(item: Record<string, unknown>, where: Record<string, unknown> = {}) {
  if (where["id"] === "__never__") return false;
  if (where["storeId"] && item["storeId"] !== where["storeId"]) return false;
  for (const key of ["status", "paymentStatus", "paymentMethod"]) {
    if (where[key] && item[key] !== where[key]) return false;
  }
  if (where["createdAt"] && !matchesDate(item["createdAt"] as Date, where["createdAt"])) return false;
  if (where["completedAt"] && !matchesDate((item["completedAt"] as Date | null) ?? undefined, where["completedAt"])) return false;
  if (where["updatedAt"] && !matchesDate(item["updatedAt"] as Date, where["updatedAt"])) return false;
  if (where["openedAt"] && !matchesDate(item["openedAt"] as Date, where["openedAt"])) return false;
  if (where["payments"] && !matchesPaymentRelation(item["payments"] as Array<Record<string, unknown>>, where["payments"] as Record<string, unknown>)) return false;
  if (where["OR"] && !matchesSearch(item, where["OR"] as Array<Record<string, Record<string, string>>>)) return false;
  return true;
}

function matchesDate(value: Date | undefined, condition: unknown) {
  if (!value || !condition || typeof condition !== "object") return true;
  const range = condition as { gte?: Date; lt?: Date };
  return (!range.gte || value >= range.gte) && (!range.lt || value < range.lt);
}

function matchesPaymentRelation(payments: Array<Record<string, unknown>>, condition: Record<string, unknown>) {
  const some = condition["some"] as Record<string, unknown> | undefined;
  if (!some) return true;
  return payments.some((paymentRow) =>
    (!some["status"] || paymentRow["status"] === some["status"]) &&
    (!some["method"] || paymentRow["method"] === some["method"])
  );
}

function matchesSearch(item: Record<string, unknown>, clauses: Array<Record<string, Record<string, string>>>) {
  return clauses.some((clause) => Object.entries(clause).some(([key, condition]) => {
    const value = item[key];
    return typeof value === "string" && value.toLowerCase().includes(condition.contains.toLowerCase());
  }));
}

function applyPaging<T>(rows: T[], args: { take?: number; skip?: number }) {
  const ordered = [...rows].sort((first: T, second: T) => {
    const firstDate = ((first as Record<string, unknown>)["createdAt"] ?? (first as Record<string, unknown>)["openedAt"]) as Date;
    const secondDate = ((second as Record<string, unknown>)["createdAt"] ?? (second as Record<string, unknown>)["openedAt"]) as Date;
    return secondDate.getTime() - firstDate.getTime();
  });
  return ordered.slice(args.skip ?? 0, args.take ?? ordered.length);
}

function product(id: string, storeId: StoreId, name: string, category: string, stockQuantity: number, minimumStock: number, stockControlEnabled: boolean) {
  return {
    id,
    storeId,
    name,
    category,
    stockQuantity: decimal(stockQuantity),
    minimumStock: decimal(minimumStock),
    stockControlEnabled
  };
}

function sale(
  id: string,
  storeId: StoreId,
  customerName: string,
  status: SaleStatus,
  total: number,
  createdAt: Date,
  completedAt: Date | null,
  payments: Array<ReturnType<typeof payment>>,
  items: Array<ReturnType<typeof saleItem>>
) {
  return {
    id,
    storeId,
    customerName,
    status,
    total: decimal(total),
    createdAt,
    completedAt,
    payments,
    items,
    paymentStatus: payments.some((item) => item.status === SalePaymentStatus.PENDING) ? SalePaymentStatus.PENDING : SalePaymentStatus.PAID,
    store: { id: storeId, name: storeId === "store-a" ? "QA_REPORTS_STORE_A" : "QA_REPORTS_STORE_B" },
    operator: { id: "operator", name: "Operador" }
  };
}

function payment(method: SalePaymentMethod, status: SalePaymentStatus, amount: number) {
  return { method, status, amount: decimal(amount) };
}

function saleItem(productId: string, productNameSnapshot: string, quantity: number, unitPrice: number, total: number) {
  return { productId, productNameSnapshot, quantity, unitPrice: decimal(unitPrice), total: decimal(total) };
}

function order(
  id: string,
  storeId: StoreId,
  customerName: string,
  status: OrderStatus,
  paymentMethod: OrderPaymentMethod,
  paymentStatus: OrderPaymentStatus,
  total: number,
  createdAt: Date,
  updatedAt: Date,
  items: Array<ReturnType<typeof orderItem>>
) {
  return {
    id,
    storeId,
    customerName,
    customerPhone: "14999999999",
    status,
    paymentMethod,
    paymentStatus,
    total: decimal(total),
    createdAt,
    updatedAt,
    items,
    store: { id: storeId, name: storeId === "store-a" ? "QA_REPORTS_STORE_A" : "QA_REPORTS_STORE_B" }
  };
}

function orderItem(productId: string, nameSnapshot: string, quantity: number, unitPrice: number, totalPrice: number) {
  return { productId, nameSnapshot, quantity, unitPrice: decimal(unitPrice), totalPrice: decimal(totalPrice) };
}

function cashSession(
  id: string,
  storeId: StoreId,
  status: CashRegisterSessionStatus,
  openedAt: Date,
  openingAmount: number,
  expectedCashAmount: number,
  countedCashAmount: number | null,
  differenceAmount: number | null,
  movements: Array<ReturnType<typeof cashMovement>>
) {
  return {
    id,
    storeId,
    status,
    openingAmount: decimal(openingAmount),
    expectedCashAmount: decimal(expectedCashAmount),
    countedCashAmount: countedCashAmount === null ? null : decimal(countedCashAmount),
    differenceAmount: differenceAmount === null ? null : decimal(differenceAmount),
    openingNotes: null,
    closingNotes: null,
    openedAt,
    closedAt: status === CashRegisterSessionStatus.CLOSED ? openedAt : null,
    cashRegister: { id: "cash-register", name: "Caixa principal" },
    openedBy: { id: "operator", name: "Operador" },
    closedBy: status === CashRegisterSessionStatus.CLOSED ? { id: "operator", name: "Operador" } : null,
    movements
  };
}

function cashMovement(type: CashMovementType, amount: number) {
  return { type, amount: decimal(amount) };
}

function stockMovement(
  storeId: StoreId,
  productId: string,
  createdAt: Date,
  type: StockMovementType,
  direction: StockMovementDirection,
  quantity: number
) {
  return { storeId, productId, createdAt, type, direction, quantity: decimal(quantity) };
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

function atLocalNoon(value: Date, timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(Number(byType.year), Number(byType.month) - 1, Number(byType.day), 15, 0, 0));
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
