import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CourierProfile,
  Store,
  StoreCourierLink,
  StoreStatus,
  User,
  UserStatus
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { StoreCourierLinkRequestedBy } from "./enums/store-courier-link-requested-by.enum";
import { StoreCourierLinkStatus } from "./enums/store-courier-link-status.enum";

type StoreCourierLinkWithRelations = StoreCourierLink & {
  store: Store;
  courier: User & {
    courierProfile: CourierProfile | null;
  };
};

@Injectable()
export class StoreCourierLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
  ) {}

  async listAvailableStoresForCourier(courierId: string) {
    await this.ensureCourier(courierId);

    const stores = await this.prisma.store.findMany({
      where: {
        active: true,
        status: StoreStatus.ACTIVE
      },
      orderBy: {
        name: "asc"
      },
      include: {
        courierLinks: {
          where: {
            courierId
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      address: store.address,
      active: store.active,
      imageUrl: store.profileImageKey ? `/media/stores/${store.id}/image` : null,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      link: store.courierLinks[0]
        ? this.serializeLinkMetadata(store.courierLinks[0])
        : null
    }));
  }

  async requestByCourier(courierId: string, storeId: string) {
    await this.ensureCourier(courierId);

    const store = await this.prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store || !store.active || store.status !== StoreStatus.ACTIVE) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    const existing = await this.prisma.storeCourierLink.findUnique({
      where: {
        courierId_storeId: {
          courierId,
          storeId
        }
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    if (existing?.status === "BLOCKED") {
      throw new BadRequestException(
        "Seu acesso a esta empresa esta bloqueado no momento"
      );
    }

    if (existing?.status === "APPROVED") {
      throw new BadRequestException("Voce ja esta vinculado a esta empresa");
    }

    if (existing?.status === "PENDING") {
      throw new BadRequestException("Ja existe uma solicitacao pendente para esta empresa");
    }

    const link = existing
      ? await this.prisma.storeCourierLink.update({
          where: { id: existing.id },
          data: {
            status: StoreCourierLinkStatus.PENDING,
            requestedBy: StoreCourierLinkRequestedBy.COURIER,
            approvedAt: null,
            rejectedAt: null
          },
          include: {
            store: true,
            courier: {
              include: {
                courierProfile: true
              }
            }
          }
        })
      : await this.prisma.storeCourierLink.create({
          data: {
            courierId,
            storeId,
            status: StoreCourierLinkStatus.PENDING,
            requestedBy: StoreCourierLinkRequestedBy.COURIER
          },
          include: {
            store: true,
            courier: {
              include: {
                courierProfile: true
              }
            }
          }
        });

    return this.serializeLink(link);
  }

  async listCourierLinks(courierId: string) {
    await this.ensureCourier(courierId);

    const links = await this.prisma.storeCourierLink.findMany({
      where: {
        courierId
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    return links.map((link) => this.serializeLink(link));
  }

  async listStoreRequests(ownerUserId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, UserRole.STORE_ADMIN);

    const requests = await this.prisma.storeCourierLink.findMany({
      where: {
        storeId: store.id,
        status: StoreCourierLinkStatus.PENDING
      },
      orderBy: {
        createdAt: "asc"
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    return requests.map((link) => this.serializeLink(link));
  }

  async approveLink(ownerUserId: string, linkId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, UserRole.STORE_ADMIN);
    const link = await this.getOwnedLink(store.id, linkId);

    if (link.status !== StoreCourierLinkStatus.PENDING) {
      throw new BadRequestException("Apenas solicitacoes pendentes podem ser aprovadas");
    }

    const updated = await this.prisma.storeCourierLink.update({
      where: { id: link.id },
      data: {
        status: StoreCourierLinkStatus.APPROVED,
        approvedAt: new Date(),
        rejectedAt: null
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    return this.serializeLink(updated);
  }

  async rejectLink(ownerUserId: string, linkId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, UserRole.STORE_ADMIN);
    const link = await this.getOwnedLink(store.id, linkId);

    if (link.status !== StoreCourierLinkStatus.PENDING) {
      throw new BadRequestException("Apenas solicitacoes pendentes podem ser rejeitadas");
    }

    const updated = await this.prisma.storeCourierLink.update({
      where: { id: link.id },
      data: {
        status: StoreCourierLinkStatus.REJECTED,
        rejectedAt: new Date(),
        approvedAt: null
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    return this.serializeLink(updated);
  }

  async listApprovedCouriers(ownerUserId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, UserRole.STORE_ADMIN);

    const links = await this.prisma.storeCourierLink.findMany({
      where: {
        storeId: store.id,
        status: StoreCourierLinkStatus.APPROVED
      },
      orderBy: {
        approvedAt: "desc"
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    return links.map((link) => this.serializeLink(link));
  }

  private async ensureCourier(courierId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: courierId }
    });

    if (!user || user.role !== UserRole.COURIER) {
      throw new NotFoundException("Motoboy nao encontrado");
    }

    if (!user.active || user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException("Motoboy inativo nao pode solicitar vinculo");
    }

    return user;
  }

  private async getOwnedLink(storeId: string, linkId: string) {
    const link = await this.prisma.storeCourierLink.findFirst({
      where: {
        id: linkId,
        storeId
      },
      include: {
        store: true,
        courier: {
          include: {
            courierProfile: true
          }
        }
      }
    });

    if (!link) {
      throw new NotFoundException("Solicitacao nao encontrada");
    }

    return link;
  }

  private serializeLink(link: StoreCourierLinkWithRelations) {
    return {
      id: link.id,
      status: link.status as StoreCourierLinkStatus,
      requestedBy: link.requestedBy as StoreCourierLinkRequestedBy,
      approvedAt: link.approvedAt,
      rejectedAt: link.rejectedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      store: {
        id: link.store.id,
        name: link.store.name,
        address: link.store.address,
        active: link.store.active,
        imageUrl: link.store.profileImageKey
          ? `/media/stores/${link.store.id}/image`
          : null,
        createdAt: link.store.createdAt,
        updatedAt: link.store.updatedAt
      },
      courier: {
        id: link.courier.id,
        name: link.courier.name,
        email: link.courier.email,
        phone: link.courier.phone,
        active: link.courier.active,
        createdAt: link.courier.createdAt,
        updatedAt: link.courier.updatedAt,
        profileCompleted: this.isCourierProfileCompleted(link.courier),
        courierProfile: link.courier.courierProfile
          ? {
              id: link.courier.courierProfile.id,
              profilePhotoUrl: link.courier.courierProfile.profileImageKey
                ? `/media/couriers/${link.courier.id}/profile-image`
                : link.courier.courierProfile.profilePhotoUrl,
              profileImageFileName: link.courier.courierProfile.profileImageFileName,
              profileImageMimeType: link.courier.courierProfile.profileImageMimeType,
              profileImageSize: link.courier.courierProfile.profileImageSize,
              profileImageUpdatedAt: link.courier.courierProfile.profileImageUpdatedAt,
              vehiclePhotoUrl: link.courier.courierProfile.vehiclePhotoUrl,
              vehicleType: link.courier.courierProfile.vehicleType,
              vehicleModel: link.courier.courierProfile.vehicleModel,
              plate: link.courier.courierProfile.plate,
              city: link.courier.courierProfile.city,
              createdAt: link.courier.courierProfile.createdAt,
              updatedAt: link.courier.courierProfile.updatedAt
            }
          : null
      }
    };
  }

  private serializeLinkMetadata(link: StoreCourierLink) {
    return {
      id: link.id,
      status: link.status as StoreCourierLinkStatus,
      requestedBy: link.requestedBy as StoreCourierLinkRequestedBy,
      approvedAt: link.approvedAt,
      rejectedAt: link.rejectedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt
    };
  }

  private isCourierProfileCompleted(courier: User & { courierProfile: CourierProfile | null }) {
    const profile = courier.courierProfile;

    return Boolean(
      courier.name &&
        courier.phone &&
        profile?.city &&
        profile.vehicleType &&
        profile.vehicleModel &&
        profile.plate
    );
  }
}
