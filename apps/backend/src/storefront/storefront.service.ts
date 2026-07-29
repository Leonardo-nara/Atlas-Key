import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  OrderEventType,
  OrderFulfillmentType,
  OrderOrigin,
  OrderPaymentMethod,
  OrderPaymentProvider,
  OrderPaymentStatus,
  OrderStatus,
  PaymentTransaction,
  Prisma,
  StoreStatus
} from "@prisma/client";
import { randomBytes } from "node:crypto";

import { MAX_MONEY_AMOUNT } from "../common/validation/money";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersRealtimeService } from "../realtime/orders-realtime.service";
import { StockService } from "../stock/stock.service";
import { StoresService } from "../stores/stores.service";
import { ClientOrderFulfillmentInput } from "../orders/dto/create-client-order.dto";
import { PaymentGatewayService } from "../orders/payment-gateway.service";
import { StorefrontCheckoutDto } from "./dto/storefront-checkout.dto";
import { UpdateStorefrontSettingsDto } from "./dto/update-storefront-settings.dto";

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "checkout",
  "dashboard",
  "entregador",
  "login",
  "loja",
  "pedido",
  "pedidos",
  "platform",
  "static",
  "storefront",
  "www"
]);

type PublicOrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    store: true;
    courier: { select: { id: true; name: true } };
    events: { orderBy: { createdAt: "asc" } };
    paymentTransactions: { orderBy: { createdAt: "desc" }; take: 1 };
  };
}>;

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly stockService: StockService,
    private readonly ordersRealtimeService: OrdersRealtimeService,
    private readonly paymentGatewayService: PaymentGatewayService
  ) {}

  async getStorefrontSettings(ownerUserId: string, role: UserRole) {
    const store = await this.storesService.getStoreByOwner(
      ownerUserId,
      role
    );

    return this.serializeStorefrontSettings(store);
  }

  async updateStorefrontSettings(
    ownerUserId: string,
    role: UserRole,
    dto: UpdateStorefrontSettingsDto
  ) {
    const store = await this.storesService.getStoreByOwner(
      ownerUserId,
      role
    );
    const slug = dto.slug !== undefined ? this.normalizeSlug(dto.slug) : undefined;
    const nextMin = dto.deliveryTimeMinMinutes ?? store.deliveryTimeMinMinutes;
    const nextMax = dto.deliveryTimeMaxMinutes ?? store.deliveryTimeMaxMinutes;

    if (nextMax < nextMin) {
      throw new BadRequestException(
        "O tempo maximo de entrega precisa ser maior ou igual ao tempo minimo."
      );
    }

    try {
      const updatedStore = await this.prisma.store.update({
        where: { id: store.id },
        data: {
          ...(slug !== undefined ? { slug } : {}),
          ...(dto.publicDescription !== undefined
            ? { publicDescription: dto.publicDescription ?? null }
            : {}),
          ...(dto.storefrontEnabled !== undefined
            ? { storefrontEnabled: dto.storefrontEnabled }
            : {}),
          ...(dto.pickupEnabled !== undefined
            ? { pickupEnabled: dto.pickupEnabled }
            : {}),
          ...(dto.businessHoursNote !== undefined
            ? { businessHoursNote: dto.businessHoursNote ?? null }
            : {}),
          ...(dto.averagePreparationMinutes !== undefined
            ? { averagePreparationMinutes: dto.averagePreparationMinutes }
            : {}),
          ...(dto.deliveryTimeMinMinutes !== undefined
            ? { deliveryTimeMinMinutes: dto.deliveryTimeMinMinutes }
            : {}),
          ...(dto.deliveryTimeMaxMinutes !== undefined
            ? { deliveryTimeMaxMinutes: dto.deliveryTimeMaxMinutes }
            : {})
        }
      });

      return this.serializeStorefrontSettings(updatedStore);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Este link de loja ja esta em uso.");
      }

      throw error;
    }
  }

  async getPublicStore(slug: string) {
    const store = await this.findStoreBySlug(slug, { allowUnavailable: true });

    if (!this.isStorePubliclyAvailable(store)) {
      return {
        status: "UNAVAILABLE",
        message: "Esta loja esta indisponivel no momento.",
        store: {
          name: store.name,
          slug: store.slug
        }
      };
    }

    const [products, deliveryZones] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { storeId: store.id, available: true },
        orderBy: [{ category: "asc" }, { name: "asc" }]
      }),
      this.prisma.storeDeliveryZone.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: [{ district: "asc" }]
      })
    ]);

    return {
      status: "OPEN",
      store: this.serializePublicStore(store),
      paymentOptions: this.getPaymentOptions(store),
      deliveryZones: deliveryZones.map((zone) => ({
        district: zone.district,
        name: zone.name,
        fee: Number(zone.fee)
      })),
      categories: [...new Set(products.map((product) => product.category))],
      products: products.map((product) => this.serializePublicProduct(product))
    };
  }

  async getDeliveryFee(
    slug: string,
    district?: string,
    fulfillmentType?: string
  ) {
    const store = await this.findAvailableStoreBySlug(slug);

    if (fulfillmentType === ClientOrderFulfillmentInput.PICKUP) {
      if (!store.pickupEnabled) {
        throw new BadRequestException("Esta loja nao habilitou retirada no local.");
      }

      return { fulfillmentType: "PICKUP", deliveryFee: 0, message: "Retirada sem taxa." };
    }

    if (!district?.trim()) {
      throw new BadRequestException("Informe o bairro para calcular a taxa.");
    }

    const zone = await this.storesService.findDeliveryZoneSuggestion(
      store.id,
      district
    );

    if (!zone) {
      throw new BadRequestException(
        "Esta loja ainda nao atende o bairro informado."
      );
    }

    return {
      fulfillmentType: "DELIVERY",
      district: zone.district,
      deliveryFee: zone.fee,
      estimatedWindow: this.buildEstimateWindow(store)
    };
  }

  async checkout(slug: string, dto: StorefrontCheckoutDto) {
    const store = await this.findAvailableStoreBySlug(slug);
    const duplicate = await this.findDuplicateOrder(store.id, dto.idempotencyKey);

    if (duplicate) {
      return this.serializeCheckoutResult(duplicate);
    }

    const fulfillmentType = dto.fulfillmentType as OrderFulfillmentType;
    const paymentMethod = this.resolvePaymentMethod(dto.paymentMethod, store);
    const payerDocument = dto.payerDocument?.trim();

    if (paymentMethod === OrderPaymentMethod.ONLINE && !payerDocument) {
      throw new BadRequestException("Informe CPF ou CNPJ para gerar o Pix automatico.");
    }

    const deliveryFee = await this.resolveDeliveryFee(store, dto);
    const customerAddress = this.buildCustomerAddress(dto);

    if (fulfillmentType === OrderFulfillmentType.DELIVERY && !customerAddress) {
      throw new BadRequestException("Informe o endereco de entrega.");
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
      throw new BadRequestException("Um ou mais produtos nao estao disponiveis.");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = dto.items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product || !this.isProductStockAvailable(product, item.quantity)) {
        throw new BadRequestException(
          `${product?.name ?? "Produto"} esta indisponivel no momento.`
        );
      }

      const unitPrice = Number(product.price);
      const totalPrice = unitPrice * item.quantity;

      if (totalPrice > MAX_MONEY_AMOUNT) {
        throw new BadRequestException("Valor do pedido acima do limite permitido.");
      }

      return {
        productId: product.id,
        nameSnapshot: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      };
    });

    const subtotal = normalizedItems.reduce(
      (total, item) => total + item.totalPrice,
      0
    );
    const total = subtotal + deliveryFee;
    const trackingToken = await this.generateTrackingToken();
    const publicOrderCode = this.generatePublicOrderCode();

    const order = await this.prisma.$transaction(async (transaction) => {
      await this.stockService.lockProductsForOrder(transaction, requestedProductIds);

      const createdOrder = await transaction.order.create({
        data: {
          storeId: store.id,
          origin: OrderOrigin.STOREFRONT,
          publicTrackingToken: trackingToken,
          publicOrderCode,
          storefrontRequestId: dto.idempotencyKey,
          fulfillmentType,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerAddress:
            fulfillmentType === OrderFulfillmentType.PICKUP
              ? "Retirada na loja"
              : customerAddress,
          addressZipCode: dto.addressZipCode ?? null,
          addressStreet: dto.addressStreet ?? null,
          addressNumber: dto.addressNumber ?? null,
          addressDistrict: dto.addressDistrict ?? null,
          addressComplement: dto.addressComplement ?? null,
          addressCity: dto.addressCity ?? null,
          addressState: dto.addressState?.toUpperCase() ?? null,
          addressReference: dto.addressReference ?? null,
          subtotal: new Prisma.Decimal(subtotal),
          suggestedDeliveryFee: new Prisma.Decimal(deliveryFee),
          deliveryFee: new Prisma.Decimal(deliveryFee),
          total: new Prisma.Decimal(total),
          paymentMethod,
          paymentStatus: OrderPaymentStatus.PENDING,
          paymentProvider:
            paymentMethod === OrderPaymentMethod.ONLINE
              ? OrderPaymentProvider.FUTURE_GATEWAY
              : OrderPaymentProvider.MANUAL,
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
        include: this.publicOrderInclude()
      });

      await transaction.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          type: OrderEventType.CREATED,
          metadata: {
            origin: "STOREFRONT"
          }
        }
      });

      await this.stockService.reserveForOrder(
        transaction,
        store.id,
        store.ownerUserId,
        createdOrder.id,
        normalizedItems
      );

      return createdOrder;
    });

    let nextOrder = order;

    if (paymentMethod === OrderPaymentMethod.ONLINE) {
      try {
        const pixPayment = await this.paymentGatewayService.createPixPayment({
          id: order.id,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          total: order.total,
          payer: {
            name: dto.customerName,
            cpfCnpj: payerDocument,
            phone: dto.customerPhone
          },
          description: `Pedido ${publicOrderCode} - Mototake`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        nextOrder = await this.prisma.$transaction(async (transaction) => {
          await transaction.paymentTransaction.create({
            data: {
              orderId: order.id,
              provider: pixPayment.provider,
              providerPaymentId: pixPayment.providerPaymentId,
              status: pixPayment.status,
              amount: pixPayment.amount,
              currency: pixPayment.currency,
              qrCodeText: pixPayment.qrCodeText,
              qrCodeImageUrl: pixPayment.qrCodeImageUrl,
              expiresAt: pixPayment.expiresAt,
              rawStatus: pixPayment.rawStatus,
              metadataJson: pixPayment.metadataJson
            }
          });

          return transaction.order.findUniqueOrThrow({
            where: { id: order.id },
            include: this.publicOrderInclude()
          });
        });
      } catch (error) {
        await this.prisma
          .$transaction(async (transaction) => {
            await this.stockService.releaseOrderReservation(
              transaction,
              order.id,
              store.ownerUserId
            );
            await transaction.order.delete({ where: { id: order.id } });
          })
          .catch(() => undefined);

        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new BadRequestException(
          "Nao foi possivel gerar o Pix automatico. Escolha outra forma de pagamento."
        );
      }
    }

    this.ordersRealtimeService.emitOrderCreated(this.serializeRealtimeOrder(nextOrder));

    return this.serializeCheckoutResult(nextOrder);
  }

  async getPublicOrder(trackingToken: string) {
    if (!/^[a-zA-Z0-9_-]{32,80}$/.test(trackingToken)) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        publicTrackingToken: trackingToken,
        origin: OrderOrigin.STOREFRONT
      },
      include: this.publicOrderInclude()
    });

    if (!order) {
      throw new NotFoundException("Pedido nao encontrado.");
    }

    return this.serializePublicOrder(order);
  }

  private async findDuplicateOrder(storeId: string, idempotencyKey: string) {
    return this.prisma.order.findFirst({
      where: {
        storeId,
        storefrontRequestId: idempotencyKey,
        origin: OrderOrigin.STOREFRONT
      },
      include: this.publicOrderInclude()
    });
  }

  private async findStoreBySlug(
    slug: string,
    options: { allowUnavailable: boolean }
  ) {
    const normalizedSlug = this.normalizeSlug(slug);
    const store = await this.prisma.store.findUnique({
      where: { slug: normalizedSlug },
      include: {
        deliveryZones: {
          where: { isActive: true },
          orderBy: { district: "asc" }
        }
      }
    });

    if (!store) {
      throw new NotFoundException("Loja nao encontrada.");
    }

    if (!options.allowUnavailable && !this.isStorePubliclyAvailable(store)) {
      throw new NotFoundException("Loja indisponivel.");
    }

    return store;
  }

  private findAvailableStoreBySlug(slug: string) {
    return this.findStoreBySlug(slug, { allowUnavailable: false });
  }

  private isStorePubliclyAvailable(store: {
    active: boolean;
    status: StoreStatus;
    storefrontEnabled: boolean;
  }) {
    return store.active && store.status === StoreStatus.ACTIVE && store.storefrontEnabled;
  }

  private async resolveDeliveryFee(
    store: { id: string; pickupEnabled: boolean },
    dto: StorefrontCheckoutDto
  ) {
    if (dto.fulfillmentType === ClientOrderFulfillmentInput.PICKUP) {
      if (!store.pickupEnabled) {
        throw new BadRequestException("Esta loja nao habilitou retirada no local.");
      }

      return 0;
    }

    if (!dto.addressDistrict?.trim()) {
      throw new BadRequestException("Informe o bairro para entrega.");
    }

    const zone = await this.storesService.findDeliveryZoneSuggestion(
      store.id,
      dto.addressDistrict
    );

    if (!zone) {
      throw new BadRequestException(
        "Esta loja ainda nao atende o bairro informado."
      );
    }

    return zone.fee;
  }

  private resolvePaymentMethod(
    paymentMethod: OrderPaymentMethod,
    store: { pixEnabled: boolean }
  ) {
    if (
      paymentMethod !== OrderPaymentMethod.CASH &&
      paymentMethod !== OrderPaymentMethod.CARD_ON_DELIVERY &&
      paymentMethod !== OrderPaymentMethod.PIX_MANUAL &&
      paymentMethod !== OrderPaymentMethod.ONLINE
    ) {
      throw new BadRequestException("Forma de pagamento invalida.");
    }

    if (paymentMethod === OrderPaymentMethod.PIX_MANUAL && !store.pixEnabled) {
      throw new BadRequestException("Pix manual nao esta habilitado nesta loja.");
    }

    if (paymentMethod === OrderPaymentMethod.ONLINE && !this.isAutomaticPixAvailable()) {
      throw new BadRequestException("Pix automatico indisponivel no momento.");
    }

    return paymentMethod;
  }

  private getPaymentOptions(store: { pixEnabled: boolean }) {
    return {
      methods: [
        OrderPaymentMethod.CASH,
        OrderPaymentMethod.CARD_ON_DELIVERY,
        ...(store.pixEnabled ? [OrderPaymentMethod.PIX_MANUAL] : []),
        ...(this.isAutomaticPixAvailable() ? [OrderPaymentMethod.ONLINE] : [])
      ]
    };
  }

  private isAutomaticPixAvailable() {
    return (
      this.paymentGatewayService.isEnabled() &&
      this.paymentGatewayService.getConfiguredProvider().toLowerCase() === "asaas"
    );
  }

  private buildCustomerAddress(dto: StorefrontCheckoutDto) {
    if (dto.fulfillmentType === ClientOrderFulfillmentInput.PICKUP) {
      return "Retirada na loja";
    }

    const parts = [
      dto.addressStreet,
      dto.addressNumber,
      dto.addressDistrict,
      dto.addressCity,
      dto.addressState?.toUpperCase()
    ].filter(Boolean);

    return parts.join(", ");
  }

  private async generateTrackingToken() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(32).toString("base64url");
      const existing = await this.prisma.order.findUnique({
        where: { publicTrackingToken: token },
        select: { id: true }
      });

      if (!existing) {
        return token;
      }
    }

    throw new BadRequestException("Nao foi possivel criar token de acompanhamento.");
  }

  private generatePublicOrderCode() {
    return `MTK-${Date.now().toString(36).toUpperCase()}-${randomBytes(2)
      .toString("hex")
      .toUpperCase()}`;
  }

  private normalizeSlug(value: string) {
    const slug = value.trim().toLowerCase();

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException("Escolha um link valido para a loja.");
    }

    return slug;
  }

  private isProductStockAvailable(
    product: {
      stockControlEnabled: boolean;
      allowNegativeStock: boolean;
      stockQuantity: Prisma.Decimal;
    },
    requestedQuantity: number
  ) {
    return (
      !product.stockControlEnabled ||
      product.allowNegativeStock ||
      product.stockQuantity.greaterThanOrEqualTo(requestedQuantity)
    );
  }

  private serializeStorefrontSettings(store: {
    id: string;
    name: string;
    slug: string | null;
    publicDescription: string | null;
    storefrontEnabled: boolean;
    pickupEnabled: boolean;
    businessHoursNote: string | null;
    averagePreparationMinutes: number;
    deliveryTimeMinMinutes: number;
    deliveryTimeMaxMinutes: number;
    updatedAt: Date;
  }) {
    return {
      storeId: store.id,
      storeName: store.name,
      slug: store.slug,
      publicDescription: store.publicDescription,
      storefrontEnabled: store.storefrontEnabled,
      pickupEnabled: store.pickupEnabled,
      businessHoursNote: store.businessHoursNote,
      averagePreparationMinutes: store.averagePreparationMinutes,
      deliveryTimeMinMinutes: store.deliveryTimeMinMinutes,
      deliveryTimeMaxMinutes: store.deliveryTimeMaxMinutes,
      publicPath: store.slug ? `/loja/${store.slug}` : null,
      updatedAt: store.updatedAt
    };
  }

  private serializePublicStore(store: {
    name: string;
    slug: string | null;
    address: string;
    publicDescription: string | null;
    pickupEnabled: boolean;
    businessHoursNote: string | null;
    averagePreparationMinutes: number;
    deliveryTimeMinMinutes: number;
    deliveryTimeMaxMinutes: number;
    profileImageKey: string | null;
    id: string;
  }) {
    return {
      name: store.name,
      slug: store.slug,
      address: store.address,
      description: store.publicDescription,
      imageUrl: store.profileImageKey ? `/media/stores/${store.id}/image` : null,
      pickupEnabled: store.pickupEnabled,
      businessHoursNote: store.businessHoursNote,
      estimatedWindow: this.buildEstimateWindow(store)
    };
  }

  private buildEstimateWindow(store: {
    averagePreparationMinutes: number;
    deliveryTimeMinMinutes: number;
    deliveryTimeMaxMinutes: number;
  }) {
    return {
      preparationMinutes: store.averagePreparationMinutes,
      deliveryMinMinutes: store.deliveryTimeMinMinutes,
      deliveryMaxMinutes: store.deliveryTimeMaxMinutes
    };
  }

  private serializePublicProduct(product: {
    id: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    category: string;
    imageUrl: string | null;
    imageKey: string | null;
    stockControlEnabled: boolean;
    stockQuantity: Prisma.Decimal;
    allowNegativeStock: boolean;
  }) {
    const stockAvailable =
      !product.stockControlEnabled ||
      product.allowNegativeStock ||
      product.stockQuantity.greaterThan(0);

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      category: product.category,
      imageUrl: product.imageKey
        ? `/media/products/${product.id}/image`
        : product.imageUrl,
      available: stockAvailable,
      availabilityLabel: stockAvailable ? "Disponivel" : "Indisponivel"
    };
  }

  private serializeCheckoutResult(order: PublicOrderWithRelations) {
    return {
      message: "Pedido recebido pela loja.",
      trackingToken: order.publicTrackingToken,
      trackingPath: `/pedido/${order.publicTrackingToken}`,
      order: this.serializePublicOrder(order)
    };
  }

  private serializePublicOrder(order: PublicOrderWithRelations) {
    const latestTransaction = order.paymentTransactions[0] as
      | PaymentTransaction
      | undefined;

    return {
      publicOrderCode: order.publicOrderCode,
      status: order.status,
      statusLabel: this.serializeStatusLabel(order),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      fulfillmentType: order.fulfillmentType,
      store: {
        name: order.store.name,
        slug: order.store.slug
      },
      customer: {
        name: order.customerName,
        phone: this.maskPhone(order.customerPhone)
      },
      address:
        order.fulfillmentType === OrderFulfillmentType.PICKUP
          ? "Retirada na loja"
          : this.maskAddress(order),
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      notes: order.notes,
      estimatedWindow: this.buildEstimateWindow(order.store),
      pixPaymentInstructions: this.buildPixPaymentInstructions(order),
      automaticPixPayment: latestTransaction
        ? {
            status: latestTransaction.status,
            amount: Number(latestTransaction.amount),
            currency: latestTransaction.currency,
            qrCodeText: latestTransaction.qrCodeText,
            qrCodeImageUrl: latestTransaction.qrCodeImageUrl,
            expiresAt: latestTransaction.expiresAt,
            paidAt: latestTransaction.paidAt
          }
        : null,
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice)
      })),
      timeline: order.events.map((event) => ({
        type: event.type,
        label: this.serializeEventLabel(event.type),
        createdAt: event.createdAt
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  private serializeRealtimeOrder(order: PublicOrderWithRelations) {
    return {
      id: order.id,
      storeId: order.storeId,
      courierId: order.courierId,
      status: order.status.toLowerCase(),
      statusLabel: this.serializeStatusLabel(order),
      customerName: order.customerName,
      total: Number(order.total),
      updatedAt: order.updatedAt
    };
  }

  private buildPixPaymentInstructions(order: PublicOrderWithRelations) {
    if (
      order.paymentMethod !== OrderPaymentMethod.PIX_MANUAL ||
      !order.store.pixEnabled ||
      !order.store.pixKeyType ||
      !order.store.pixKey ||
      !order.store.pixRecipientName
    ) {
      return null;
    }

    return {
      pixKeyType: order.store.pixKeyType,
      pixKey: order.store.pixKey,
      pixRecipientName: order.store.pixRecipientName,
      pixInstructions:
        order.store.pixInstructions ??
        "Envie o comprovante para a loja. O pagamento sera confirmado manualmente."
    };
  }

  private serializeStatusLabel(order: { status: OrderStatus; storeConfirmedAt: Date | null }) {
    if (order.status === OrderStatus.PENDING && !order.storeConfirmedAt) {
      return "Aguardando confirmacao da loja";
    }

    if (order.status === OrderStatus.PENDING && order.storeConfirmedAt) {
      return "Confirmado pela loja";
    }

    if (order.status === OrderStatus.ACCEPTED) return "Motoboy aceitou";
    if (order.status === OrderStatus.ASSIGNED) return "Aguardando retirada";
    if (order.status === OrderStatus.OUT_FOR_DELIVERY) return "Saiu para entrega";
    if (order.status === OrderStatus.DELIVERED) return "Entregue";
    return "Cancelado";
  }

  private serializeEventLabel(type: OrderEventType) {
    const labels: Record<OrderEventType, string> = {
      CREATED: "Pedido recebido",
      ACCEPTED: "Motoboy aceitou",
      PICKED_UP: "Saiu para entrega",
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
      PAYMENT_PAID: "Pagamento confirmado",
      PAYMENT_PROOF_SUBMITTED: "Comprovante enviado",
      PAYMENT_PROOF_APPROVED: "Comprovante aprovado",
      PAYMENT_PROOF_REJECTED: "Comprovante recusado"
    };

    return labels[type];
  }

  private maskPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return phone;
    return `${digits.slice(0, 2)}*****${digits.slice(-4)}`;
  }

  private maskAddress(order: PublicOrderWithRelations) {
    return [
      order.addressStreet,
      order.addressDistrict,
      order.addressCity,
      order.addressState
    ]
      .filter(Boolean)
      .join(", ");
  }

  private publicOrderInclude() {
    return {
      items: true,
      store: true,
      courier: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: "asc" as const } },
      paymentTransactions: {
        orderBy: { createdAt: "desc" as const },
        take: 1
      }
    };
  }
}
