import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, StorePixKeyType } from "@prisma/client";

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

    return store;
  }

  async getStoreProfile(ownerUserId: string, role: UserRole) {
    const store = await this.getStoreByOwner(ownerUserId, role);

    return this.serializeStore(store);
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
      where: { id: storeId, active: true },
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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
