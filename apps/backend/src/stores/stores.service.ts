import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  SaleStatus,
  StoreCourierLinkStatus,
  StorePixKeyType,
  StoreStatus,
  UserStatus
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { ImageStorageService } from "../common/storage/image-storage.service";
import type { UploadedFile } from "../common/storage/uploaded-file.interface";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";
import { UpdateStorePixSettingsDto } from "./dto/update-store-pix-settings.dto";

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorageService: ImageStorageService
  ) {}

  async getStoreByOwner(ownerUserId: string, role: UserRole) {
    if (role !== UserRole.STORE_ADMIN) {
      throw new ForbiddenException("Apenas STORE_ADMIN possui loja");
    }

    const store = await this.prisma.store.findUnique({
      where: { ownerUserId }
    });

    if (!store) {
      throw new NotFoundException("Loja nao encontrada");
    }

    if (!store.active || store.status !== StoreStatus.ACTIVE) {
      throw new ForbiddenException("Loja suspensa ou inativa nao pode operar");
    }

    return store;
  }

  async getStoreProfile(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    return this.serializeStore(store);
  }

  async getDashboard(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    const { startOfToday, startOfTomorrow } = getTodayRange();

    const [
      ordersToday,
      pendingOrders,
      inProgressOrders,
      deliveredToday,
      revenueToday,
      pendingPayments,
      activeProducts,
      activeCouriers,
      controlledStockProducts
    ] = await this.prisma.$transaction([
      this.prisma.order.count({
        where: {
          storeId: store.id,
          createdAt: { gte: startOfToday, lt: startOfTomorrow }
        }
      }),
      this.prisma.order.count({
        where: { storeId: store.id, status: OrderStatus.PENDING }
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: {
            in: [
              OrderStatus.ACCEPTED,
              OrderStatus.ASSIGNED,
              OrderStatus.OUT_FOR_DELIVERY
            ]
          }
        }
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: OrderStatus.DELIVERED,
          updatedAt: { gte: startOfToday, lt: startOfTomorrow }
        }
      }),
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: startOfToday, lt: startOfTomorrow }
        },
        _sum: { total: true }
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: { not: OrderStatus.CANCELLED },
          paymentStatus: OrderPaymentStatus.PENDING
        }
      }),
      this.prisma.product.count({
        where: { storeId: store.id, available: true }
      }),
      this.prisma.storeCourierLink.count({
        where: {
          storeId: store.id,
          status: StoreCourierLinkStatus.APPROVED,
          courier: {
            active: true,
            status: UserStatus.ACTIVE
          }
        }
      }),
      this.prisma.product.findMany({
        where: { storeId: store.id, stockControlEnabled: true },
        select: { stockQuantity: true, minimumStock: true }
      })
    ]);

    return {
      storeId: store.id,
      storeName: store.name,
      generatedAt: new Date(),
      ordersToday,
      pendingOrders,
      inProgressOrders,
      deliveredToday,
      estimatedRevenueToday: Number(revenueToday._sum.total ?? 0),
      pendingPayments,
      activeProducts,
      activeCouriers,
      lowStockProducts: controlledStockProducts.filter(
        (product) =>
          product.stockQuantity.greaterThan(0) &&
          product.stockQuantity.lessThanOrEqualTo(product.minimumStock)
      ).length,
      outOfStockProducts: controlledStockProducts.filter((product) =>
        product.stockQuantity.lessThanOrEqualTo(0)
      ).length
    };
  }

  async getReadiness(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    const [
      activeProducts,
      productsWithoutValidPrice,
      activeControlledProducts,
      activeControlledProductsWithInvalidStock,
      activeDeliveryZones,
      activeCouriers,
      activeCashRegisters,
      completedSales,
      deliveredOrders,
      productsWithImage
    ] = await this.prisma.$transaction([
      this.prisma.product.count({
        where: { storeId: store.id, available: true }
      }),
      this.prisma.product.count({
        where: {
          storeId: store.id,
          available: true,
          price: { lte: new Prisma.Decimal(0) }
        }
      }),
      this.prisma.product.count({
        where: {
          storeId: store.id,
          available: true,
          stockControlEnabled: true
        }
      }),
      this.prisma.product.count({
        where: {
          storeId: store.id,
          available: true,
          stockControlEnabled: true,
          OR: [
            { stockQuantity: { lt: new Prisma.Decimal(0) } },
            { minimumStock: { lt: new Prisma.Decimal(0) } }
          ]
        }
      }),
      this.prisma.storeDeliveryZone.count({
        where: { storeId: store.id, isActive: true }
      }),
      this.prisma.storeCourierLink.count({
        where: {
          storeId: store.id,
          status: StoreCourierLinkStatus.APPROVED,
          courier: {
            active: true,
            status: UserStatus.ACTIVE
          }
        }
      }),
      this.prisma.cashRegister.count({
        where: { storeId: store.id, active: true }
      }),
      this.prisma.sale.count({
        where: { storeId: store.id, status: SaleStatus.COMPLETED }
      }),
      this.prisma.order.count({
        where: { storeId: store.id, status: OrderStatus.DELIVERED }
      }),
      this.prisma.product.count({
        where: {
          storeId: store.id,
          available: true,
          imageKey: { not: null }
        }
      })
    ]);

    const pixConfigured = Boolean(
      store.pixKeyType && store.pixKey && store.pixRecipientName
    );
    const hasProfile = Boolean(store.name.trim() && store.address.trim());
    const items = [
      createReadinessItem({
        key: "store-profile",
        title: "Perfil da empresa",
        description: "Nome e endereco da loja preenchidos para identificacao no painel.",
        category: "REQUIRED",
        completed: hasProfile,
        actionLabel: "Revisar perfil",
        route: "/"
      }),
      createReadinessItem({
        key: "active-product",
        title: "Catalogo com produto ativo",
        description: "Cadastre pelo menos um produto disponivel para venda.",
        category: "REQUIRED",
        completed: activeProducts > 0,
        actionLabel: "Abrir produtos",
        route: "/products"
      }),
      createReadinessItem({
        key: "valid-product-prices",
        title: "Precos validos",
        description: "Produtos ativos precisam ter preco maior que zero.",
        category: "REQUIRED",
        completed: activeProducts > 0 && productsWithoutValidPrice === 0,
        actionLabel: "Conferir produtos",
        route: "/products"
      }),
      createReadinessItem({
        key: "stock-configured",
        title: "Estoque configurado",
        description: "Produtos com controle de estoque devem ter saldo e minimo validos.",
        category: "REQUIRED",
        completed:
          activeControlledProducts === 0 ||
          activeControlledProductsWithInvalidStock === 0,
        actionLabel: "Abrir estoque",
        route: "/stock"
      }),
      createReadinessItem({
        key: "delivery-zones",
        title: "Taxas por bairro",
        description: "Cadastre pelo menos uma regiao ativa para sugerir taxa de entrega.",
        category: "REQUIRED",
        completed: activeDeliveryZones > 0,
        actionLabel: "Configurar taxas",
        route: "/delivery-zones"
      }),
      createReadinessItem({
        key: "basic-payment-methods",
        title: "Formas basicas de pagamento",
        description: "Dinheiro e cartao na entrega estao disponiveis no sistema.",
        category: "REQUIRED",
        completed: true,
        actionLabel: "Ver pedidos",
        route: "/orders"
      }),
      createReadinessItem({
        key: "pix-manual",
        title: "Pix manual",
        description: store.pixEnabled
          ? "Complete chave Pix e nome do recebedor para usar Pix manual."
          : "Ative somente se a loja for receber Pix manualmente.",
        category: store.pixEnabled ? "REQUIRED" : "RECOMMENDED",
        completed: store.pixEnabled ? pixConfigured : true,
        actionLabel: "Configurar Pix",
        route: "/pix-settings"
      }),
      createReadinessItem({
        key: "cash-register",
        title: "Caixa preparado",
        description: "Crie pelo menos um caixa ativo para vendas de balcão.",
        category: "REQUIRED",
        completed: activeCashRegisters > 0,
        actionLabel: "Abrir caixa",
        route: "/cash-registers"
      }),
      createReadinessItem({
        key: "linked-courier",
        title: "Motoboy vinculado",
        description: "Tenha pelo menos um motoboy aprovado para entregas próprias.",
        category: "RECOMMENDED",
        completed: activeCouriers > 0,
        actionLabel: "Gerenciar motoboys",
        route: "/couriers"
      }),
      createReadinessItem({
        key: "store-image",
        title: "Foto da loja",
        description: "Adicione uma imagem da empresa para deixar o catalogo mais profissional.",
        category: "RECOMMENDED",
        completed: Boolean(store.profileImageKey),
        actionLabel: "Alterar foto",
        route: "/"
      }),
      createReadinessItem({
        key: "product-images",
        title: "Fotos dos produtos",
        description: "Inclua imagens nos produtos principais para melhorar a apresentacao.",
        category: "RECOMMENDED",
        completed: activeProducts > 0 && productsWithImage > 0,
        actionLabel: "Editar produtos",
        route: "/products"
      }),
      createReadinessItem({
        key: "test-operation",
        title: "Operacao testada",
        description: "Realize uma venda de teste ou conclua um pedido para validar a rotina.",
        category: "RECOMMENDED",
        completed: completedSales > 0 || deliveredOrders > 0,
        actionLabel: "Abrir PDV",
        route: "/pdv"
      })
    ];

    const requiredItems = items.filter((item) => item.category === "REQUIRED");
    const scoredItems = items.filter((item) => item.category !== "OPTIONAL");
    const completedItems = scoredItems.filter((item) => item.completed).length;
    const requiredCompletedItems = requiredItems.filter((item) => item.completed).length;

    return {
      storeId: store.id,
      storeName: store.name,
      ready: requiredCompletedItems === requiredItems.length,
      percentage:
        scoredItems.length > 0
          ? Math.round((completedItems / scoredItems.length) * 100)
          : 100,
      completedItems,
      totalItems: scoredItems.length,
      requiredCompletedItems,
      requiredTotalItems: requiredItems.length,
      generatedAt: new Date(),
      items
    };
  }

  async uploadStoreImage(
    ownerUserId: string,
    role: UserRole,
    file: UploadedFile
  ) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    const storedImage = await this.imageStorageService.saveImage(
      `stores/${store.id}`,
      file
    );

    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        profileImageKey: storedImage.storageKey,
        profileImageFileName: storedImage.originalFileName,
        profileImageMimeType: storedImage.mimeType,
        profileImageSize: storedImage.size,
        profileImageUpdatedAt: new Date()
      }
    });

    await this.imageStorageService.deleteImage(store.profileImageKey);

    return this.serializeStore(updatedStore);
  }

  async removeStoreImage(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        profileImageKey: null,
        profileImageFileName: null,
        profileImageMimeType: null,
        profileImageSize: null,
        profileImageUpdatedAt: null
      }
    });

    await this.imageStorageService.deleteImage(store.profileImageKey);

    return {
      message: "Imagem da loja removida com sucesso"
    };
  }

  async getStoreImage(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, active: true, status: StoreStatus.ACTIVE },
      select: {
        profileImageKey: true,
        profileImageFileName: true,
        profileImageMimeType: true,
        profileImageSize: true
      }
    });

    if (!store?.profileImageKey || !store.profileImageFileName || !store.profileImageMimeType || !store.profileImageSize) {
      throw new NotFoundException("Imagem da loja nao encontrada");
    }

    return this.imageStorageService.readImage(store.profileImageKey, {
      fileName: store.profileImageFileName,
      mimeType: store.profileImageMimeType,
      size: store.profileImageSize
    });
  }

  async listDeliveryZones(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    const zones = await this.prisma.storeDeliveryZone.findMany({
      where: { storeId: store.id },
      orderBy: [{ isActive: "desc" }, { district: "asc" }]
    });

    return zones.map((zone) => this.serializeDeliveryZone(zone));
  }

  async getPixSettings(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    return this.serializePixSettings(store);
  }

  async updatePixSettings(
    ownerUserId: string,
    role: UserRole,
    dto: UpdateStorePixSettingsDto
  ) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    const nextSettings = {
      pixEnabled: dto.pixEnabled ?? store.pixEnabled,
      pixKeyType: dto.pixKeyType ?? store.pixKeyType,
      pixKey:
        dto.pixKey !== undefined
          ? dto.pixKey.trim() || null
          : store.pixKey,
      pixRecipientName:
        dto.pixRecipientName !== undefined
          ? dto.pixRecipientName.trim() || null
          : store.pixRecipientName,
      pixInstructions:
        dto.pixInstructions !== undefined
          ? dto.pixInstructions.trim() || null
          : store.pixInstructions
    };

    if (nextSettings.pixEnabled) {
      this.validateEnabledPixSettings(nextSettings);
    }

    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data: nextSettings
    });

    return this.serializePixSettings(updatedStore);
  }

  async createDeliveryZone(
    ownerUserId: string,
    role: UserRole,
    dto: CreateDeliveryZoneDto
  ) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    try {
      const zone = await this.prisma.storeDeliveryZone.create({
        data: {
          storeId: store.id,
          name: dto.name,
          district: dto.district,
          districtNormalized: normalizeDistrict(dto.district),
          fee: new Prisma.Decimal(dto.fee),
          isActive: dto.isActive ?? true
        }
      });

      return this.serializeDeliveryZone(zone);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Ja existe uma taxa cadastrada para este bairro");
      }

      throw error;
    }
  }

  async updateDeliveryZone(
    ownerUserId: string,
    role: UserRole,
    zoneId: string,
    dto: UpdateDeliveryZoneDto
  ) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    await this.ensureDeliveryZoneBelongsToStore(zoneId, store.id);

    const district = dto.district?.trim();

    try {
      const zone = await this.prisma.storeDeliveryZone.update({
        where: { id: zoneId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(district !== undefined
            ? {
                district,
                districtNormalized: normalizeDistrict(district)
              }
            : {}),
          ...(dto.fee !== undefined ? { fee: new Prisma.Decimal(dto.fee) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
        }
      });

      return this.serializeDeliveryZone(zone);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Ja existe uma taxa cadastrada para este bairro");
      }

      throw error;
    }
  }

  async deactivateDeliveryZone(ownerUserId: string, role: UserRole, zoneId: string) {
    const store = await this.getStoreByOwner(ownerUserId, role);
    await this.ensureDeliveryZoneBelongsToStore(zoneId, store.id);

    const zone = await this.prisma.storeDeliveryZone.update({
      where: { id: zoneId },
      data: { isActive: false }
    });

    return this.serializeDeliveryZone(zone);
  }

  async findDeliveryZoneSuggestion(storeId: string, district?: string | null) {
    if (!district?.trim()) {
      return null;
    }

    const zone = await this.prisma.storeDeliveryZone.findFirst({
      where: {
        storeId,
        districtNormalized: normalizeDistrict(district),
        isActive: true
      }
    });

    return zone ? this.serializeDeliveryZone(zone) : null;
  }

  private async ensureDeliveryZoneBelongsToStore(zoneId: string, storeId: string) {
    const zone = await this.prisma.storeDeliveryZone.findUnique({
      where: { id: zoneId },
      select: { storeId: true }
    });

    if (!zone || zone.storeId !== storeId) {
      throw new NotFoundException("Regiao de entrega nao encontrada para a loja");
    }
  }

  private serializeDeliveryZone(zone: {
    id: string;
    storeId: string;
    name: string;
    district: string;
    districtNormalized: string;
    fee: Prisma.Decimal;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: zone.id,
      storeId: zone.storeId,
      name: zone.name,
      district: zone.district,
      districtNormalized: zone.districtNormalized,
      fee: Number(zone.fee),
      isActive: zone.isActive,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt
    };
  }

  serializeStore(store: {
    id: string;
    name: string;
    address: string;
    ownerUserId?: string;
    active: boolean;
    status?: StoreStatus;
    profileImageKey?: string | null;
    profileImageFileName?: string | null;
    profileImageMimeType?: string | null;
    profileImageSize?: number | null;
    profileImageUpdatedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...store,
      profileImageKey: undefined,
      imageUrl: store.profileImageKey ? `/media/stores/${store.id}/image` : null
    };
  }

  private validateEnabledPixSettings(settings: {
    pixKeyType: StorePixKeyType | null;
    pixKey: string | null;
    pixRecipientName: string | null;
  }) {
    if (!settings.pixKeyType || !settings.pixKey || !settings.pixRecipientName) {
      throw new BadRequestException(
        "Para ativar Pix manual, informe tipo de chave, chave Pix e nome do recebedor"
      );
    }
  }

  private serializePixSettings(store: {
    id: string;
    pixKeyType: StorePixKeyType | null;
    pixKey: string | null;
    pixRecipientName: string | null;
    pixInstructions: string | null;
    pixEnabled: boolean;
    updatedAt: Date;
  }) {
    return {
      storeId: store.id,
      pixKeyType: store.pixKeyType,
      pixKey: store.pixKey,
      pixRecipientName: store.pixRecipientName,
      pixInstructions: store.pixInstructions,
      pixEnabled: store.pixEnabled,
      updatedAt: store.updatedAt
    };
  }
}

export function normalizeDistrict(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getTodayRange(reference = new Date()) {
  const startOfToday = new Date(reference);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  return { startOfToday, startOfTomorrow };
}

type ReadinessCategory = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";

function createReadinessItem(item: {
  key: string;
  title: string;
  description: string;
  category: ReadinessCategory;
  completed: boolean;
  actionLabel: string;
  route: string;
}) {
  return item;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
