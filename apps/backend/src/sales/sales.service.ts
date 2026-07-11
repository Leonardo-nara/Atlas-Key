import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  SaleEventType,
  SalePaymentMethod,
  SalePaymentStatus,
  SaleStatus
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { AddSaleItemDto } from "./dto/add-sale-item.dto";
import { CancelSaleDto } from "./dto/cancel-sale.dto";
import { CompleteSaleDto } from "./dto/complete-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { UpdateSaleItemDto } from "./dto/update-sale-item.dto";

const SALE_INCLUDE = {
  store: {
    select: {
      id: true,
      name: true,
      address: true
    }
  },
  operator: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  items: {
    orderBy: { createdAt: "asc" }
  },
  payments: {
    orderBy: { createdAt: "asc" }
  },
  events: {
    orderBy: { createdAt: "asc" },
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  }
} satisfies Prisma.SaleInclude;

type SaleWithRelations = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
  ) {}

  async create(operatorUserId: string, role: UserRole, dto: CreateSaleDto) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.sale.create({
      data: {
        storeId: store.id,
        operatorUserId,
        customerName: dto.customerName,
        customerDocument: dto.customerDocument,
        notes: dto.notes,
        events: {
          create: {
            type: SaleEventType.SALE_CREATED,
            actorUserId: operatorUserId,
            actorRole: role,
            metadata: {
              storeId: store.id
            }
          }
        }
      },
      include: SALE_INCLUDE
    });

    return this.serializeSale(sale);
  }

  async list(operatorUserId: string, role: UserRole, query: ListSalesQueryDto) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.SaleWhereInput = {
      storeId: store.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search, mode: "insensitive" } },
              { customerName: { contains: query.search, mode: "insensitive" } },
              { customerDocument: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.sale.count({ where })
    ]);

    return {
      items: items.map((sale) => this.serializeSale(sale)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findOne(operatorUserId: string, role: UserRole, saleId: string) {
    const sale = await this.findOwnedSale(operatorUserId, role, saleId);

    return this.serializeSale(sale);
  }

  async addItem(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    dto: AddSaleItemDto
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      const currentSale = await this.findDraftSaleInTransaction(
        prisma,
        saleId,
        store.id
      );
      const product = await prisma.product.findFirst({
        where: {
          id: dto.productId,
          storeId: store.id,
          available: true
        }
      });

      if (!product) {
        throw new NotFoundException("Produto nao encontrado para esta loja");
      }

      const existingItem = currentSale.items.find(
        (item) => item.productId === product.id
      );

      if (existingItem) {
        const nextQuantity = existingItem.quantity + dto.quantity;
        await prisma.saleItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: nextQuantity,
            total: this.calculateItemTotal(
              product.price,
              nextQuantity,
              existingItem.discountAmount,
              existingItem.surchargeAmount
            )
          }
        });
      } else {
        await prisma.saleItem.create({
          data: {
            saleId,
            productId: product.id,
            productNameSnapshot: product.name,
            unitPrice: product.price,
            quantity: dto.quantity,
            total: this.calculateItemTotal(product.price, dto.quantity)
          }
        });
      }

      return this.recalculateSale(prisma, saleId);
    });

    return this.serializeSale(sale);
  }

  async updateItem(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    itemId: string,
    dto: UpdateSaleItemDto
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      await this.findDraftSaleInTransaction(prisma, saleId, store.id);
      const item = await prisma.saleItem.findFirst({
        where: { id: itemId, saleId }
      });

      if (!item) {
        throw new NotFoundException("Item da venda nao encontrado");
      }

      const quantity = dto.quantity ?? item.quantity;
      const discountAmount =
        dto.discountAmount === undefined
          ? item.discountAmount
          : new Prisma.Decimal(dto.discountAmount);
      const surchargeAmount =
        dto.surchargeAmount === undefined
          ? item.surchargeAmount
          : new Prisma.Decimal(dto.surchargeAmount);
      const total = this.calculateItemTotal(
        item.unitPrice,
        quantity,
        discountAmount,
        surchargeAmount
      );

      await prisma.saleItem.update({
        where: { id: item.id },
        data: {
          quantity,
          discountAmount,
          surchargeAmount,
          total
        }
      });

      return this.recalculateSale(prisma, saleId);
    });

    return this.serializeSale(sale);
  }

  async removeItem(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    itemId: string
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      await this.findDraftSaleInTransaction(prisma, saleId, store.id);
      const item = await prisma.saleItem.findFirst({
        where: { id: itemId, saleId }
      });

      if (!item) {
        throw new NotFoundException("Item da venda nao encontrado");
      }

      await prisma.saleItem.delete({ where: { id: item.id } });

      return this.recalculateSale(prisma, saleId);
    });

    return this.serializeSale(sale);
  }

  async update(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    dto: UpdateSaleDto
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      await this.findDraftSaleInTransaction(prisma, saleId, store.id);
      const discountAmount =
        dto.discountAmount === undefined
          ? undefined
          : new Prisma.Decimal(dto.discountAmount);
      const surchargeAmount =
        dto.surchargeAmount === undefined
          ? undefined
          : new Prisma.Decimal(dto.surchargeAmount);

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          customerName: dto.customerName,
          customerDocument: dto.customerDocument,
          notes: dto.notes,
          discountAmount,
          surchargeAmount
        }
      });

      const updatedSale = await this.recalculateSale(prisma, saleId);

      if (dto.discountAmount !== undefined && dto.discountAmount > 0) {
        await prisma.saleEvent.create({
          data: {
            saleId,
            type: SaleEventType.SALE_DISCOUNT_APPLIED,
            actorUserId: operatorUserId,
            actorRole: role,
            metadata: {
              storeId: store.id,
              saleId,
              discountAmount: dto.discountAmount
            }
          }
        });
      }

      return updatedSale;
    });

    return this.serializeSale(sale);
  }

  async complete(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    dto: CompleteSaleDto
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      const currentSale = await this.findDraftSaleInTransaction(
        prisma,
        saleId,
        store.id
      );

      if (currentSale.items.length === 0) {
        throw new BadRequestException("Venda sem itens nao pode ser finalizada");
      }

      if (dto.payments.some((payment) => payment.method === SalePaymentMethod.PIX_AUTOMATIC)) {
        throw new BadRequestException(
          "Pix automatico para PDV ainda nao esta habilitado nesta fase"
        );
      }

      const recalculatedSale = await this.recalculateSale(prisma, saleId);
      const paymentTotal = dto.payments.reduce(
        (sum, payment) => sum.add(new Prisma.Decimal(payment.amount)),
        new Prisma.Decimal(0)
      );

      if (!paymentTotal.equals(recalculatedSale.total)) {
        throw new BadRequestException("A soma dos pagamentos deve ser igual ao total da venda");
      }

      await prisma.salePayment.deleteMany({ where: { saleId } });
      await prisma.salePayment.createMany({
        data: dto.payments.map((payment) => ({
          saleId,
          method: payment.method,
          amount: new Prisma.Decimal(payment.amount),
          status: SalePaymentStatus.PAID,
          provider: payment.method === SalePaymentMethod.PIX_MANUAL ? "MANUAL" : null,
          paidAt: new Date()
        }))
      });

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.COMPLETED,
          paymentStatus: SalePaymentStatus.PAID,
          completedAt: new Date()
        }
      });

      await prisma.saleEvent.create({
        data: {
          saleId,
          type: SaleEventType.SALE_COMPLETED,
          actorUserId: operatorUserId,
          actorRole: role,
          metadata: {
            storeId: store.id,
            saleId,
            subtotal: Number(recalculatedSale.subtotal),
            discountAmount: Number(recalculatedSale.discountAmount),
            surchargeAmount: Number(recalculatedSale.surchargeAmount),
            total: Number(recalculatedSale.total),
            paymentMethods: dto.payments.map((payment) => payment.method)
          }
        }
      });

      return this.findSaleById(prisma, saleId);
    });

    return this.serializeSale(sale);
  }

  async cancel(
    operatorUserId: string,
    role: UserRole,
    saleId: string,
    dto: CancelSaleDto
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    const sale = await this.prisma.$transaction(async (prisma) => {
      const currentSale = await this.findOwnedSaleInTransaction(
        prisma,
        saleId,
        store.id
      );

      if (currentSale.status === SaleStatus.CANCELLED) {
        throw new ConflictException("Venda ja esta cancelada");
      }

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.CANCELLED,
          paymentStatus:
            currentSale.paymentStatus === SalePaymentStatus.PAID
              ? SalePaymentStatus.REFUNDED
              : SalePaymentStatus.CANCELLED,
          cancelReason: dto.reason,
          cancelledAt: new Date()
        }
      });

      await prisma.saleEvent.create({
        data: {
          saleId,
          type: SaleEventType.SALE_CANCELLED,
          actorUserId: operatorUserId,
          actorRole: role,
          metadata: {
            storeId: store.id,
            saleId,
            reason: dto.reason,
            total: Number(currentSale.total)
          }
        }
      });

      return this.findSaleById(prisma, saleId);
    });

    return this.serializeSale(sale);
  }

  async receipt(operatorUserId: string, role: UserRole, saleId: string) {
    const sale = await this.findOwnedSale(operatorUserId, role, saleId);

    return {
      notice: "DOCUMENTO SEM VALOR FISCAL",
      generatedAt: new Date(),
      sale: this.serializeSale(sale)
    };
  }

  private async findOwnedSale(
    operatorUserId: string,
    role: UserRole,
    saleId: string
  ) {
    const store = await this.storesService.getStoreByOwner(operatorUserId, role);

    return this.findOwnedSaleInTransaction(this.prisma, saleId, store.id);
  }

  private async findOwnedSaleInTransaction(
    prisma: Pick<PrismaService, "sale">,
    saleId: string,
    storeId: string
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE
    });

    if (!sale || sale.storeId !== storeId) {
      throw new NotFoundException("Venda nao encontrada para esta loja");
    }

    return sale;
  }

  private async findDraftSaleInTransaction(
    prisma: Pick<PrismaService, "sale">,
    saleId: string,
    storeId: string
  ) {
    const sale = await this.findOwnedSaleInTransaction(prisma, saleId, storeId);

    if (sale.status !== SaleStatus.DRAFT) {
      throw new ConflictException("Venda finalizada ou cancelada nao pode ser alterada");
    }

    return sale;
  }

  private async findSaleById(prisma: Pick<PrismaService, "sale">, saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: SALE_INCLUDE
    });

    if (!sale) {
      throw new NotFoundException("Venda nao encontrada");
    }

    return sale;
  }

  private async recalculateSale(
    prisma: Pick<PrismaService, "sale" | "saleItem">,
    saleId: string
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true
      }
    });

    if (!sale) {
      throw new NotFoundException("Venda nao encontrada");
    }

    const subtotal = sale.items.reduce(
      (sum, item) => sum.add(item.total),
      new Prisma.Decimal(0)
    );
    const total = subtotal.sub(sale.discountAmount).add(sale.surchargeAmount);

    if (total.lessThan(0)) {
      throw new BadRequestException("Desconto nao pode deixar o total negativo");
    }

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        subtotal,
        total
      }
    });

    return this.findSaleById(prisma as Pick<PrismaService, "sale">, saleId);
  }

  private calculateItemTotal(
    unitPrice: Prisma.Decimal,
    quantity: number,
    discountAmount: Prisma.Decimal = new Prisma.Decimal(0),
    surchargeAmount: Prisma.Decimal = new Prisma.Decimal(0)
  ) {
    const total = unitPrice.mul(quantity).sub(discountAmount).add(surchargeAmount);

    if (total.lessThan(0)) {
      throw new BadRequestException("Desconto do item nao pode deixar o total negativo");
    }

    return total;
  }

  private serializeSale(sale: SaleWithRelations) {
    return {
      ...sale,
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      surchargeAmount: Number(sale.surchargeAmount),
      total: Number(sale.total),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        surchargeAmount: Number(item.surchargeAmount),
        total: Number(item.total)
      })),
      payments: sale.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount)
      })),
      events: sale.events.map((event) => ({
        ...event,
        type: event.type.toLowerCase()
      }))
    };
  }
}
