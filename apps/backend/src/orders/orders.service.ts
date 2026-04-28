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
  OrderFulfillmentType,
  OrderItem,
  OrderPaymentMethod,
  OrderPaymentProvider,
  OrderPaymentStatus,
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
import { ConfirmOrderDto } from "./dto/confirm-order.dto";
import { CreateClientOrderDto } from "./dto/create-client-order.dto";
import { ClientOrderFulfillmentInput } from "./dto/create-client-order.dto";
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
    const paymentMethod = dto.paymentMethod ?? OrderPaymentMethod.CASH;

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
          paymentMethod,
          paymentStatus: OrderPaymentStatus.PENDING,
          paymentProvider: this.resolvePaymentProvider(paymentMethod),
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
    const fulfillmentType = dto.fulfillmentType as OrderFulfillmentType;
    const paymentMethod = dto.paymentMethod ?? OrderPaymentMethod.CASH;
    const customerAddress = this.buildCustomerAddress(dto);
    const suggestedDeliveryZone =
      fulfillmentType === OrderFulfillmentType.DELIVERY
        ? await this.storesService.findDeliveryZoneSuggestion(
            store.id,
            dto.addressDistrict
          )
        : null;

    if (fulfillmentType === OrderFulfillmentType.DELIVERY && !customerAddress) {
      throw new BadRequestException("Endereco de entrega obrigatorio");
    }

    const order = await this.prisma.$transaction(async (transaction) => {
      const createdOrder = await transaction.order.create({
        data: {
          storeId: store.id,
          clientId: client.id,
          fulfillmentType,
          customerName: client.name,
          customerPhone: client.phone,
          customerAddress,
          addressStreet: dto.addressStreet?.trim() || null,
          addressNumber: dto.addressNumber?.trim() || null,
          addressDistrict: dto.addressDistrict?.trim() || null,
          addressComplement: dto.addressComplement?.trim() || null,
          addressCity: dto.addressCity?.trim() || null,
          addressReference: dto.addressReference?.trim() || null,
          subtotal: new Prisma.Decimal(subtotal),
          suggestedDeliveryFee: suggestedDeliveryZone
            ? new Prisma.Decimal(suggestedDeliveryZone.fee)
            : null,
          deliveryFee: new Prisma.Decimal(deliveryFee),
          total: new Prisma.Decimal(total),
          paymentMethod,
          paymentStatus: OrderPaymentStatus.PENDING,
          paymentProvider: this.resolvePaymentProvider(paymentMethod),
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
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
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
        status: OrderStatus.PENDING,
        OR: [
          { clientId: null },
          { storeConfirmedAt: { not: null } }
        ]
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

  async confirmOrder(
    orderId: string,
    ownerUserId: string,
    role: UserRole,
    dto: ConfirmOrderDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);

    const updatedOrder = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      });

      if (!order || order.storeId !== store.id) {
        throw new NotFoundException("Pedido nao encontrado para a loja autenticada");
      }

      if (order.status !== PrismaOrderStatus.PENDING) {
        throw new BadRequestException(
          "Somente pedidos pendentes podem ser confirmados"
        );
      }

      if (order.storeConfirmedAt) {
        throw new BadRequestException("Pedido ja foi confirmado pela loja");
      }

      const deliveryFee =
        order.fulfillmentType === OrderFulfillmentType.PICKUP
          ? 0
          : dto.deliveryFee ??
            (order.suggestedDeliveryFee
              ? Number(order.suggestedDeliveryFee)
              : Number(order.deliveryFee));
      const total = Number(order.subtotal) + deliveryFee;

      const updated = await transaction.order.update({
        where: { id: orderId },
        data: {
          deliveryFee: new Prisma.Decimal(deliveryFee),
          total: new Prisma.Decimal(total),
          storeConfirmedAt: new Date()
        },
        include: {
          items: true,
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      });

      await transaction.orderEvent.create({
        data: {
          orderId,
          type: OrderEventType.ACCEPTED,
          actorUserId: ownerUserId,
          actorRole: PrismaUserRole.STORE_ADMIN,
          metadata: {
            deliveryFee
          }
        }
      });

      return updated;
    });

    const serializedOrder = this.serializeOrder(updatedOrder);
    this.ordersRealtimeService.emitOrderStatusUpdated(serializedOrder);

    return serializedOrder;
  }

  async markManualPaymentPaid(
    orderId: string,
    ownerUserId: string,
    role: UserRole
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);

    const updatedOrder = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      });

      if (!order || order.storeId !== store.id) {
        throw new NotFoundException("Pedido nao encontrado para a loja autenticada");
      }

      if (order.paymentMethod === OrderPaymentMethod.ONLINE) {
        throw new BadRequestException(
          "Pagamento online sera tratado por integracao futura"
        );
      }

      if (order.status === PrismaOrderStatus.CANCELLED) {
        throw new BadRequestException(
          "Nao e possivel marcar pagamento de pedido cancelado"
        );
      }

      if (order.paymentStatus === OrderPaymentStatus.PAID) {
        return order;
      }

      const updated = await transaction.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: OrderPaymentStatus.PAID,
          paymentProvider: OrderPaymentProvider.MANUAL,
          paidAt: new Date()
        },
        include: {
          items: true,
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      });

      await transaction.orderEvent.create({
        data: {
          orderId,
          type: OrderEventType.PAYMENT_PAID,
          actorUserId: ownerUserId,
          actorRole: PrismaUserRole.STORE_ADMIN,
          metadata: {
            paymentMethod: order.paymentMethod
          }
        }
      });

      return updated;
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

  private buildCustomerAddress(dto: CreateClientOrderDto) {
    if (dto.fulfillmentType === ClientOrderFulfillmentInput.PICKUP) {
      return dto.customerAddress?.trim() || "Retirada na loja";
    }

    const parts = [
      dto.addressStreet?.trim(),
      dto.addressNumber?.trim(),
      dto.addressDistrict?.trim(),
      dto.addressCity?.trim()
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join(", ")
      : dto.customerAddress?.trim() ?? "";
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

  private resolvePaymentProvider(paymentMethod: OrderPaymentMethod) {
    return paymentMethod === OrderPaymentMethod.ONLINE
      ? OrderPaymentProvider.FUTURE_GATEWAY
      : OrderPaymentProvider.MANUAL;
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
          store: true,
          courier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
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
    order: Order & {
      items: OrderItem[];
      store?: { id: string; name: string; address: string };
      courier?: { id: string; name: string; email: string; phone: string } | null;
    }
  ) {
    return {
      ...order,
      subtotal: Number(order.subtotal),
      suggestedDeliveryFee: order.suggestedDeliveryFee
        ? Number(order.suggestedDeliveryFee)
        : null,
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      statusLabel: this.serializeOrderStatus(order),
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
        store: true,
        courier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
  }

  private serializeCourierStatus(status: OrderStatus) {
    if (status === OrderStatus.OUT_FOR_DELIVERY) {
      return "picked_up";
    }

    return status.toLowerCase();
  }

  private serializeOrderStatus(order: Order) {
    if (
      order.status === OrderStatus.PENDING &&
      order.clientId &&
      !order.storeConfirmedAt
    ) {
      return "awaiting_store_confirmation";
    }

    if (
      order.status === OrderStatus.PENDING &&
      order.clientId &&
      order.storeConfirmedAt
    ) {
      return "confirmed";
    }

    return this.serializeCourierStatus(order.status as OrderStatus);
  }
}
