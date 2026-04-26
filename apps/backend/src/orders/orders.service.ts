import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Order,
  OrderEvent,
  OrderEventType,
  OrderItem,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  UserRole as PrismaUserRole
} from "@prisma/client";

import { OrderStatus } from "../common/enums/order-status.enum";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersRealtimeService } from "../realtime/orders-realtime.service";
import { StoreCourierLinkStatus } from "../store-courier-links/enums/store-courier-link-status.enum";
import { StoresService } from "../stores/stores.service";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CreateClientOrderDto } from "./dto/create-client-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrderAuditEvent } from "./order-audit-event.interface";
import {
  CourierOrderStatusInput,
  UpdateCourierOrderStatusDto
} from "./dto/update-courier-order-status.dto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly ordersRealtimeService: OrdersRealtimeService
  ) {}

  async create(ownerUserId: string, role: UserRole, dto: CreateOrderDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const productIds = dto.items
      .map((item) => item.productId)
      .filter((value): value is string => Boolean(value));

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: {
            id: { in: productIds },
            storeId: store.id
          }
        })
      : [];

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        "Um ou mais produtos informados nao pertencem a loja autenticada"
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const normalizedItems = dto.items.map((item) => {
      const product = item.productId ? productMap.get(item.productId) : undefined;

      if (!item.productId && (item.unitPrice === undefined || !item.nameSnapshot)) {
        throw new BadRequestException(
          "Itens sem productId precisam informar nameSnapshot e unitPrice"
        );
      }

      const unitPrice = product ? Number(product.price) : item.unitPrice!;
      const totalPrice = unitPrice * item.quantity;

      return {
        productId: product?.id ?? null,
        nameSnapshot: product?.name ?? item.nameSnapshot!,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      };
    });

    const subtotal = normalizedItems.reduce(
      (accumulator, item) => accumulator + item.totalPrice,
      0
    );
    const total = subtotal + dto.deliveryFee;

    const order = await this.prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          storeId: store.id,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerAddress: dto.customerAddress,
          subtotal: new Prisma.Decimal(subtotal),
          deliveryFee: new Prisma.Decimal(dto.deliveryFee),
          total: new Prisma.Decimal(total),
          notes: dto.notes,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              nameSnapshot: item.nameSnapshot,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              totalPrice: new Prisma.Decimal(item.totalPrice)
            }))
          }
        },
        include: {
          items: true
        }
      });

      await transaction.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          type: OrderEventType.CREATED,
          actorUserId: ownerUserId,
          actorRole: PrismaUserRole.STORE_ADMIN
        }
      });

      return createdOrder;
    });

    const serializedOrder = this.serializeOrder(order);
    this.ordersRealtimeService.emitOrderCreated(serializedOrder);

    return serializedOrder;
  }

  async createClientOrder(
    clientUserId: string,
    role: UserRole,
    dto: CreateClientOrderDto
  ) {
    this.ensureClient(role);

    const client = await this.prisma.user.findFirst({
      where: {
        id: clientUserId,
        role: PrismaUserRole.CLIENT,
        active: true
      },
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    if (!client) {
      throw new ForbiddenException("Conta de cliente nao encontrada");
    }

    const store = await this.prisma.store.findFirst({
      where: {
        id: dto.storeId,
        active: true
      },
      select: {
        id: true
      }
    });

    if (!store) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    const requestedProductIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: requestedProductIds },
        storeId: store.id,
        available: true
      }
    });

    if (products.length !== requestedProductIds.length) {
      throw new BadRequestException(
        "Um ou mais produtos nao estao disponiveis nesta empresa"
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = dto.items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new BadRequestException("Produto indisponivel para o pedido");
      }

      const unitPrice = Number(product.price);
      const totalPrice = unitPrice * item.quantity;

      return {
        productId: product.id,
        nameSnapshot: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      };
    });

    const subtotal = normalizedItems.reduce(
      (accumulator, item) => accumulator + item.totalPrice,
      0
    );
    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    const order = await this.prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          storeId: store.id,
          clientId: client.id,
          customerName: client.name,
          customerPhone: client.phone,
          customerAddress: dto.customerAddress,
          subtotal: new Prisma.Decimal(subtotal),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          total: new Prisma.Decimal(total),
          notes: dto.notes,
          items: {
            create: normalizedItems.map((item) => ({
              productId: item.productId,
              nameSnapshot: item.nameSnapshot,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              totalPrice: new Prisma.Decimal(item.totalPrice)
            }))
          }
        },
        include: {
          items: true,
          store: true
        }
      });

      await transaction.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          type: OrderEventType.CREATED,
          actorUserId: clientUserId,
          actorRole: PrismaUserRole.CLIENT
        }
      });

      return createdOrder;
    });

    const serializedOrder = this.serializeOrder(order);
    this.ordersRealtimeService.emitOrderCreated(serializedOrder);

    return serializedOrder;
  }

  async list(
    ownerUserId: string,
    role: UserRole,
    query: ListOrdersQueryDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const where: Prisma.OrderWhereInput = {
      storeId: store.id
    };

    if (query.status) {
      where.status = this.parseStatusFilter(query.status);
    }

    return this.paginateOrders(where, query);
  }

  async listClientOrders(
    clientUserId: string,
    role: UserRole,
    query: ListOrdersQueryDto
  ) {
    this.ensureClient(role);

    const where: Prisma.OrderWhereInput = {
      clientId: clientUserId
    };

    if (query.status) {
      where.status = this.parseStatusFilter(query.status);
    }

    return this.paginateOrders(where, query);
  }

  async getHistory(orderId: string, ownerUserId: string, role: UserRole) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: store.id
      },
      select: { id: true }
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado para a loja autenticada");
    }

    const history = await this.prisma.orderEvent.findMany({
      where: { orderId },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return history.map((event) => this.serializeAuditEvent(event));
  }

  async listAvailableForCourier(
    courierUserId: string,
    role: UserRole,
    query: ListOrdersQueryDto
  ) {
    this.ensureCourier(role);

    const approvedStoreIds = await this.getApprovedStoreIdsForCourier(courierUserId);

    if (approvedStoreIds.length === 0) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;

      return {
        items: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1
        }
      };
    }

    return this.paginateOrders(
      {
        storeId: {
          in: approvedStoreIds
        },
        courierId: null,
        status: OrderStatus.PENDING
      },
      query
    );
  }

  async listCourierOrders(
    courierUserId: string,
    role: UserRole,
    query: ListOrdersQueryDto
  ) {
    this.ensureCourier(role);

    const where: Prisma.OrderWhereInput = {
      courierId: courierUserId
    };

    if (query.scope === "active") {
      where.status = {
        in: [OrderStatus.ACCEPTED, OrderStatus.OUT_FOR_DELIVERY]
      };
    }

    if (query.scope === "completed") {
      where.status = {
        in: [OrderStatus.DELIVERED]
      };
    }

    if (query.status) {
      where.status = this.parseStatusFilter(query.status);
    }

    return this.paginateOrders(where, query);
  }

  async acceptOrder(orderId: string, courierUserId: string, role: UserRole) {
    this.ensureCourier(role);
    const approvedStoreIds = await this.getApprovedStoreIdsForCourier(courierUserId);

    const updatedOrder = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          store: true
        }
      });

      if (!order) {
        throw new NotFoundException("Pedido nao encontrado");
      }

      if (!approvedStoreIds.includes(order.storeId)) {
        throw new ForbiddenException(
          "Voce so pode aceitar pedidos de empresas com vinculo aprovado"
        );
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          "Somente pedidos pendentes podem ser aceitos"
        );
      }

      if (order.courierId) {
        if (order.courierId === courierUserId) {
          throw new BadRequestException("Pedido ja aceito por voce");
        }

        throw new ForbiddenException("Pedido ja aceito por outro motoboy");
      }

      const updated = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: PrismaOrderStatus.PENDING,
          courierId: null
        },
        data: {
          courierId: courierUserId,
          status: PrismaOrderStatus.ACCEPTED
        }
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          "Nao foi possivel aceitar o pedido. Atualize a lista e tente novamente."
        );
      }

      await transaction.orderEvent.create({
        data: {
          orderId,
          type: OrderEventType.ACCEPTED,
          actorUserId: courierUserId,
          actorRole: PrismaUserRole.COURIER
        }
      });

      return this.getOrderWithRelations(transaction, orderId);
    });

    const serializedOrder = this.serializeOrder(updatedOrder);
    this.ordersRealtimeService.emitOrderAccepted(serializedOrder);

    return serializedOrder;
  }

  async updateCourierOrderStatus(
    orderId: string,
    courierUserId: string,
    role: UserRole,
    dto: UpdateCourierOrderStatusDto
  ) {
    this.ensureCourier(role);

    const nextStatus = this.mapCourierStatus(dto.status);
    const updatedOrder = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          store: true
        }
      });

      if (!order) {
        throw new NotFoundException("Pedido nao encontrado");
      }

      if (order.courierId !== courierUserId) {
        throw new ForbiddenException("Pedido nao pertence ao motoboy autenticado");
      }

      this.ensureStatusTransition(order.status as OrderStatus, nextStatus);

      const updated = await transaction.order.updateMany({
        where: {
          id: orderId,
          courierId: courierUserId,
          status: order.status
        },
        data: {
          status: nextStatus
        }
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          "Nao foi possivel atualizar o pedido. Atualize a lista e tente novamente."
        );
      }

      await transaction.orderEvent.create({
        data: {
          orderId,
          type: this.mapOrderEventType(nextStatus),
          actorUserId: courierUserId,
          actorRole: PrismaUserRole.COURIER
        }
      });

      return this.getOrderWithRelations(transaction, orderId);
    });

    const serializedOrder = this.serializeOrder(updatedOrder);
    this.ordersRealtimeService.emitOrderStatusUpdated(serializedOrder);

    return serializedOrder;
  }

  async cancelOrder(
    orderId: string,
    ownerUserId: string,
    role: UserRole,
    dto: CancelOrderDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const updatedOrder = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          store: true
        }
      });

      if (!order || order.storeId !== store.id) {
        throw new NotFoundException("Pedido nao encontrado para a loja autenticada");
      }

      if (order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException(
          "Pedidos entregues nao podem mais ser cancelados"
        );
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException("Pedido ja foi cancelado");
      }

      const updated = await transaction.order.updateMany({
        where: {
          id: orderId,
          storeId: store.id,
          status: {
            notIn: [PrismaOrderStatus.DELIVERED, PrismaOrderStatus.CANCELLED]
          }
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
          cancelReason: dto.reason?.trim() || null
        }
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          "Nao foi possivel cancelar o pedido. Atualize a lista e tente novamente."
        );
      }

      await transaction.orderEvent.create({
        data: {
          orderId,
          type: OrderEventType.CANCELLED,
          actorUserId: ownerUserId,
          actorRole: PrismaUserRole.STORE_ADMIN,
          metadata: dto.reason?.trim()
            ? {
                reason: dto.reason.trim()
              }
            : undefined
        }
      });

      return this.getOrderWithRelations(transaction, orderId);
    });

    const serializedOrder = this.serializeOrder(updatedOrder);
    this.ordersRealtimeService.emitOrderCancelled(serializedOrder);

    return serializedOrder;
  }

  private ensureCourier(role: UserRole) {
    if (role !== UserRole.COURIER) {
      throw new ForbiddenException("Apenas COURIER pode acessar este fluxo");
    }
  }

  private ensureClient(role: UserRole) {
    if (role !== UserRole.CLIENT) {
      throw new ForbiddenException("Apenas CLIENT pode acessar este fluxo");
    }
  }

  private async getApprovedStoreIdsForCourier(courierUserId: string) {
    const links = await this.prisma.storeCourierLink.findMany({
      where: {
        courierId: courierUserId,
        status: StoreCourierLinkStatus.APPROVED
      },
      select: {
        storeId: true
      }
    });

    return links.map((link) => link.storeId);
  }

  private mapCourierStatus(input: CourierOrderStatusInput) {
    if (input === CourierOrderStatusInput.ACCEPTED) {
      return OrderStatus.ACCEPTED;
    }

    if (input === CourierOrderStatusInput.PICKED_UP) {
      return OrderStatus.OUT_FOR_DELIVERY;
    }

    return OrderStatus.DELIVERED;
  }

  private ensureStatusTransition(current: OrderStatus, next: OrderStatus) {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.ACCEPTED],
      [OrderStatus.ACCEPTED]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.ASSIGNED]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: []
    };

    if (!allowedTransitions[current]?.includes(next) && current !== next) {
      throw new BadRequestException(
        `Transicao invalida: ${this.serializeCourierStatus(current)} -> ${this.serializeCourierStatus(next)}`
      );
    }
  }

  private parseStatusFilter(value: ListOrdersQueryDto["status"]) {
    if (value === "pending") {
      return OrderStatus.PENDING;
    }

    if (value === "accepted") {
      return OrderStatus.ACCEPTED;
    }

    if (value === "picked_up") {
      return OrderStatus.OUT_FOR_DELIVERY;
    }

    if (value === "delivered") {
      return OrderStatus.DELIVERED;
    }

    return OrderStatus.CANCELLED;
  }

  private mapOrderEventType(status: OrderStatus): OrderEventType {
    if (status === OrderStatus.ACCEPTED) {
      return OrderEventType.ACCEPTED;
    }

    if (status === OrderStatus.OUT_FOR_DELIVERY) {
      return OrderEventType.PICKED_UP;
    }

    if (status === OrderStatus.DELIVERED) {
      return OrderEventType.DELIVERED;
    }

    return OrderEventType.CANCELLED;
  }

  private async paginateOrders(
    where: Prisma.OrderWhereInput,
    query: ListOrdersQueryDto
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          store: true
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map((order) => this.serializeOrder(order)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  private serializeOrder(
    order: Order & { items: OrderItem[]; store?: { id: string; name: string; address: string } }
  ) {
    return {
      ...order,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      statusLabel: this.serializeCourierStatus(order.status as OrderStatus),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      }))
    };
  }

  private serializeAuditEvent(
    event: OrderEvent & {
      actorUser?: { id: string; name: string; email: string } | null;
    }
  ): OrderAuditEvent {
    const metadata =
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;

    return {
      id: event.id,
      orderId: event.orderId,
      type: event.type.toLowerCase() as OrderAuditEvent["type"],
      actorUserId: event.actorUserId,
      actorRole: event.actorRole as OrderAuditEvent["actorRole"],
      actorName: event.actorUser?.name ?? null,
      actorEmail: event.actorUser?.email ?? null,
      reason:
        typeof metadata?.reason === "string"
          ? metadata.reason
          : null,
      createdAt: event.createdAt.toISOString()
    };
  }

  private getOrderWithRelations(
    transaction: Prisma.TransactionClient,
    orderId: string
  ) {
    return transaction.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: true,
        store: true
      }
    });
  }

  private serializeCourierStatus(status: OrderStatus) {
    if (status === OrderStatus.OUT_FOR_DELIVERY) {
      return "picked_up";
    }

    return status.toLowerCase();
  }
}
