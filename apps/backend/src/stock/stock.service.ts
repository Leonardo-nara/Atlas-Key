import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  StockMovementDirection,
  StockMovementType
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements-query.dto";
import { ListStockProductsQueryDto } from "./dto/list-stock-products-query.dto";
import { UpdateStockSettingsDto } from "./dto/update-stock-settings.dto";

type StockTransaction = Prisma.TransactionClient;
type StockItem = { productId: string | null; quantity: number };

const MANUAL_TYPES = new Set<StockMovementType>([
  StockMovementType.PURCHASE_ENTRY,
  StockMovementType.MANUAL_ENTRY,
  StockMovementType.MANUAL_EXIT,
  StockMovementType.INVENTORY_ADJUSTMENT
]);

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
  ) {}

  async listProducts(ownerUserId: string, role: UserRole, query: ListStockProductsQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const products = await this.prisma.product.findMany({
      where: {
        storeId: store.id,
        ...(query.stockControlEnabled === undefined
          ? {}
          : { stockControlEnabled: query.stockControlEnabled }),
        ...(query.search?.trim()
          ? {
              OR: [
                { name: { contains: query.search.trim(), mode: "insensitive" } },
                { category: { contains: query.search.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }]
    });

    const status = query.status ?? "all";
    const filtered = products.filter((product) => {
      if (status === "all") return true;
      if (!product.stockControlEnabled) return status === "available";
      if (status === "out") return product.stockQuantity.lessThanOrEqualTo(0);
      if (status === "low") {
        return product.stockQuantity.greaterThan(0) &&
          product.stockQuantity.lessThanOrEqualTo(product.minimumStock);
      }
      return product.allowNegativeStock || product.stockQuantity.greaterThan(0);
    });

    return {
      items: filtered.slice((page - 1) * limit, page * limit).map((product) => this.serializeProduct(product)),
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit))
    };
  }

  async getProduct(ownerUserId: string, role: UserRole, productId: string) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);
    const movements = await this.prisma.stockMovement.findMany({
      where: { productId, storeId: product.storeId },
      include: { createdByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30
    });
    return { ...this.serializeProduct(product), movements: movements.map((item) => this.serializeMovement(item)) };
  }

  async updateSettings(
    ownerUserId: string,
    role: UserRole,
    productId: string,
    dto: UpdateStockSettingsDto
  ) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      const current = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const activating = !current.stockControlEnabled && dto.stockControlEnabled;
      const initial = new Prisma.Decimal(dto.initialQuantity ?? 0);

      if (!activating && dto.initialQuantity !== undefined) {
        throw new BadRequestException("Quantidade inicial so pode ser informada ao ativar o controle");
      }
      if (current.stockControlEnabled && !dto.stockControlEnabled && !current.stockQuantity.equals(0)) {
        throw new BadRequestException("Zere o saldo antes de desativar o controle de estoque");
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          stockControlEnabled: dto.stockControlEnabled,
          minimumStock: new Prisma.Decimal(dto.minimumStock),
          allowNegativeStock: dto.allowNegativeStock,
          ...(activating ? { stockQuantity: initial } : {}),
          stockUpdatedAt: new Date()
        }
      });

      if (activating && initial.greaterThan(0)) {
        await tx.stockMovement.create({
          data: {
            storeId: product.storeId,
            productId,
            createdByUserId: ownerUserId,
            type: StockMovementType.INITIAL,
            direction: StockMovementDirection.IN,
            quantity: initial,
            balanceBefore: current.stockQuantity,
            balanceAfter: initial,
            reason: "Ativacao do controle de estoque"
          }
        });
      }
      return this.serializeProduct(updated);
    });
  }

  async createMovement(
    ownerUserId: string,
    role: UserRole,
    productId: string,
    dto: CreateStockMovementDto
  ) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);
    if (!product.stockControlEnabled) {
      throw new BadRequestException("Ative o controle de estoque antes de movimentar o produto");
    }
    if (!MANUAL_TYPES.has(dto.type)) {
      throw new BadRequestException("Tipo de movimentacao manual nao permitido");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      const current = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      let after: Prisma.Decimal;
      let direction: StockMovementDirection;
      let quantity: Prisma.Decimal;

      if (dto.type === StockMovementType.INVENTORY_ADJUSTMENT) {
        if (dto.targetQuantity === undefined) {
          throw new BadRequestException("Informe o saldo contado para o ajuste de inventario");
        }
        after = new Prisma.Decimal(dto.targetQuantity);
        const difference = after.minus(current.stockQuantity);
        if (difference.equals(0)) throw new BadRequestException("O saldo informado ja e o saldo atual");
        direction = difference.greaterThan(0) ? StockMovementDirection.IN : StockMovementDirection.OUT;
        quantity = difference.abs();
      } else {
        if (dto.quantity === undefined) throw new BadRequestException("Informe a quantidade");
        quantity = new Prisma.Decimal(dto.quantity);
        direction = dto.type === StockMovementType.MANUAL_EXIT
          ? StockMovementDirection.OUT
          : StockMovementDirection.IN;
        after = direction === StockMovementDirection.IN
          ? current.stockQuantity.add(quantity)
          : current.stockQuantity.sub(quantity);
      }

      if (!current.allowNegativeStock && after.lessThan(0)) {
        throw new BadRequestException("Estoque insuficiente para esta saida");
      }

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: after, stockUpdatedAt: new Date() }
      });
      const movement = await tx.stockMovement.create({
        data: {
          storeId: product.storeId,
          productId,
          createdByUserId: ownerUserId,
          type: dto.type,
          direction,
          quantity,
          balanceBefore: current.stockQuantity,
          balanceAfter: after,
          reason: dto.reason,
          sourceReference: dto.sourceReference
        }
      });
      return this.serializeMovement(movement);
    });
  }

  async listMovements(ownerUserId: string, role: UserRole, query: ListStockMovementsQueryDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const where: Prisma.StockMovementWhereInput = {
      storeId: store.id,
      productId: query.productId,
      type: query.type,
      direction: query.direction,
      createdAt: query.dateFrom || query.dateTo
        ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined }
        : undefined
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true } }, createdByUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.stockMovement.count({ where })
    ]);
    return { items: items.map((item) => this.serializeMovement(item)), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getSummary(ownerUserId: string, role: UserRole) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const products = await this.prisma.product.findMany({ where: { storeId: store.id, stockControlEnabled: true } });
    return {
      controlledProducts: products.length,
      availableProducts: products.filter((item) => item.stockQuantity.greaterThan(item.minimumStock)).length,
      lowStockProducts: products.filter((item) => item.stockQuantity.greaterThan(0) && item.stockQuantity.lessThanOrEqualTo(item.minimumStock)).length,
      outOfStockProducts: products.filter((item) => item.stockQuantity.lessThanOrEqualTo(0)).length
    };
  }

  async consumeForSale(tx: StockTransaction, storeId: string, actorUserId: string, saleId: string, items: StockItem[]) {
    await this.consume(tx, storeId, actorUserId, items, StockMovementType.PDV_SALE, { saleId });
  }

  async reserveForOrder(tx: StockTransaction, storeId: string, actorUserId: string, orderId: string, items: StockItem[]) {
    await this.consume(tx, storeId, actorUserId, items, StockMovementType.DELIVERY_RESERVED, { orderId });
  }

  async releaseOrderReservation(tx: StockTransaction, orderId: string, actorUserId: string) {
    const reservations = await tx.stockMovement.findMany({
      where: { orderId, type: StockMovementType.DELIVERY_RESERVED },
      orderBy: { productId: "asc" }
    });
    for (const reservation of reservations) {
      const released = await tx.stockMovement.findFirst({
        where: { orderId, productId: reservation.productId, type: StockMovementType.DELIVERY_RELEASED }
      });
      if (released) continue;
      await this.lockProduct(tx, reservation.productId);
      const product = await tx.product.findUniqueOrThrow({ where: { id: reservation.productId } });
      const after = product.stockQuantity.add(reservation.quantity);
      await tx.product.update({ where: { id: product.id }, data: { stockQuantity: after, stockUpdatedAt: new Date() } });
      await tx.stockMovement.create({
        data: {
          storeId: reservation.storeId,
          productId: reservation.productId,
          createdByUserId: actorUserId,
          type: StockMovementType.DELIVERY_RELEASED,
          direction: StockMovementDirection.IN,
          quantity: reservation.quantity,
          balanceBefore: product.stockQuantity,
          balanceAfter: after,
          reason: "Reserva liberada pelo cancelamento do pedido",
          orderId
        }
      });
    }
  }

  private async consume(
    tx: StockTransaction,
    storeId: string,
    actorUserId: string,
    items: StockItem[],
    type: StockMovementType,
    source: { orderId?: string; saleId?: string }
  ) {
    const quantities = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      if (!item.productId) continue;
      quantities.set(item.productId, (quantities.get(item.productId) ?? new Prisma.Decimal(0)).add(item.quantity));
    }
    for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const duplicate = await tx.stockMovement.findFirst({ where: { productId, type, ...source } });
      if (duplicate) continue;
      await this.lockProduct(tx, productId);
      const product = await tx.product.findFirst({ where: { id: productId, storeId } });
      if (!product) throw new BadRequestException("Produto nao pertence a esta loja");
      if (!product.stockControlEnabled) continue;
      const after = product.stockQuantity.sub(quantity);
      if (!product.allowNegativeStock && after.lessThan(0)) {
        throw new BadRequestException(`Estoque insuficiente para ${product.name}`);
      }
      await tx.product.update({ where: { id: productId }, data: { stockQuantity: after, stockUpdatedAt: new Date() } });
      await tx.stockMovement.create({
        data: {
          storeId,
          productId,
          createdByUserId: actorUserId,
          type,
          direction: StockMovementDirection.OUT,
          quantity,
          balanceBefore: product.stockQuantity,
          balanceAfter: after,
          reason: type === StockMovementType.PDV_SALE ? "Baixa por venda no PDV" : "Reserva para pedido delivery",
          ...source
        }
      });
    }
  }

  private async lockProduct(tx: StockTransaction, productId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`);
  }

  private async findOwnedProduct(ownerUserId: string, role: UserRole, productId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const product = await this.prisma.product.findFirst({ where: { id: productId, storeId: store.id } });
    if (!product) throw new NotFoundException("Produto nao encontrado para esta loja");
    return product;
  }

  private serializeProduct(product: Prisma.ProductGetPayload<Record<string, never>>) {
    const stockStatus = !product.stockControlEnabled
      ? "UNCONTROLLED"
      : product.stockQuantity.lessThanOrEqualTo(0)
        ? "OUT"
        : product.stockQuantity.lessThanOrEqualTo(product.minimumStock)
          ? "LOW"
          : "NORMAL";
    return {
      ...product,
      imageKey: undefined,
      price: Number(product.price),
      stockQuantity: Number(product.stockQuantity),
      minimumStock: Number(product.minimumStock),
      stockStatus
    };
  }

  private serializeMovement<T extends { quantity: Prisma.Decimal; balanceBefore: Prisma.Decimal; balanceAfter: Prisma.Decimal }>(movement: T) {
    return { ...movement, quantity: Number(movement.quantity), balanceBefore: Number(movement.balanceBefore), balanceAfter: Number(movement.balanceAfter) };
  }
}
