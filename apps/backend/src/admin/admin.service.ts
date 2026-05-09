import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  StoreCourierLinkStatus,
  StoreStatus,
  UserRole as PrismaUserRole,
  UserStatus
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAdminStoreDto } from "./dto/create-admin-store.dto";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { ListAdminAuditLogsQueryDto } from "./dto/list-admin-audit-logs-query.dto";
import { UpdateAdminStoreStatusDto } from "./dto/update-admin-store-status.dto";
import { UpdateAdminUserStatusDto } from "./dto/update-admin-user-status.dto";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditLogs(query: ListAdminAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.adminUserId ? { adminUserId: query.adminUserId } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          adminUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      this.prisma.adminAuditLog.count({ where })
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async listStores() {
    const stores = await this.prisma.store.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: this.safeUserSelect()
        },
        _count: {
          select: {
            products: true,
            orders: true,
            courierLinks: true
          }
        }
      }
    });

    return stores.map((store) => this.serializeStore(store));
  }

  async getStore(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: {
          select: this.safeUserSelect()
        },
        _count: {
          select: {
            products: true,
            orders: true,
            courierLinks: true,
            deliveryZones: true
          }
        }
      }
    });

    if (!store) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    return this.serializeStore(store);
  }

  async createStore(dto: CreateAdminStoreDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail }
    });

    if (existingUser) {
      throw new ConflictException("Email do dono ja esta cadastrado");
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);
    const created = await this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: dto.ownerEmail,
          passwordHash,
          phone: dto.ownerPhone?.trim() ?? "",
          role: PrismaUserRole.STORE_ADMIN,
          status: UserStatus.ACTIVE,
          active: true
        },
        select: this.safeUserSelect()
      });

      const store = await tx.store.create({
        data: {
          name: dto.storeName,
          address: dto.storeAddress,
          ownerUserId: owner.id,
          status: StoreStatus.ACTIVE,
          active: true
        },
        include: {
          owner: {
            select: this.safeUserSelect()
          },
          _count: {
            select: {
              products: true,
              orders: true,
              courierLinks: true
            }
          }
        }
      });

      return store;
    });

    return this.serializeStore(created);
  }

  async updateStoreStatus(
    adminUserId: string,
    storeId: string,
    dto: UpdateAdminStoreStatusDto
  ) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, status: true, active: true }
    });

    if (!store) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextStore = await tx.store.update({
        where: { id: storeId },
        data: {
          status: dto.status,
          active: dto.status === StoreStatus.ACTIVE
        },
        include: {
          owner: {
            select: this.safeUserSelect()
          },
          _count: {
            select: {
              products: true,
              orders: true,
              courierLinks: true
            }
          }
        }
      });

      await this.createAuditLog(tx, {
        adminUserId,
        action: this.statusAction("STORE", dto.status),
        targetType: "STORE",
        targetId: storeId,
        reason: dto.reason,
        metadataJson: {
          previousStatus: store.status,
          nextStatus: dto.status,
          previousActive: store.active,
          nextActive: dto.status === StoreStatus.ACTIVE
        }
      });

      return nextStore;
    });

    return this.serializeStore(updated);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        ...this.safeUserSelect(),
        ownedStore: {
          select: {
            id: true,
            name: true,
            status: true,
            active: true
          }
        },
        courierProfile: {
          select: {
            id: true,
            city: true,
            vehicleType: true,
            vehicleModel: true,
            plate: true
          }
        }
      }
    });

    return users;
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.safeUserSelect(),
        ownedStore: {
          select: {
            id: true,
            name: true,
            status: true,
            active: true
          }
        },
        courierProfile: {
          select: {
            id: true,
            city: true,
            vehicleType: true,
            vehicleModel: true,
            plate: true
          }
        },
        storeLinks: {
          select: {
            id: true,
            status: true,
            requestedBy: true,
            store: {
              select: {
                id: true,
                name: true,
                status: true,
                active: true
              }
            }
          },
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    return user;
  }

  async createUser(dto: CreateAdminUserDto) {
    if (dto.role === UserRole.STORE_ADMIN) {
      throw new BadRequestException(
        "Use Empresas > Criar empresa para criar dono de loja com loja vinculada"
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ConflictException("Email ja cadastrado");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          phone: dto.phone?.trim() ?? "",
          role: dto.role as PrismaUserRole,
          status: UserStatus.ACTIVE,
          active: true
        },
        select: this.safeUserSelect()
      });

      if (dto.role === UserRole.COURIER) {
        await tx.courierProfile.create({
          data: {
            userId: createdUser.id
          }
        });
      }

      return createdUser;
    });

    return user;
  }

  async updateUserStatus(
    adminUserId: string,
    userId: string,
    dto: UpdateAdminUserStatusDto,
    auditTarget: { prefix: "USER" | "COURIER"; type: "USER" | "COURIER" } = {
      prefix: "USER",
      type: "USER"
    }
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, active: true }
    });

    if (!existing) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    const active = dto.status === UserStatus.ACTIVE;
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          status: dto.status,
          active
        },
        select: this.safeUserSelect()
      });

      if (!active) {
        await tx.authSession.updateMany({
          where: {
            userId,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
      }

      await this.createAuditLog(tx, {
        adminUserId,
        action: this.statusAction(auditTarget.prefix, dto.status),
        targetType: auditTarget.type,
        targetId: userId,
        reason: dto.reason,
        metadataJson: {
          role: existing.role,
          previousStatus: existing.status,
          nextStatus: dto.status,
          previousActive: existing.active,
          nextActive: active
        }
      });

      return user;
    });

    return updated;
  }

  async listCouriers() {
    const couriers = await this.prisma.user.findMany({
      where: { role: PrismaUserRole.COURIER },
      orderBy: { createdAt: "desc" },
      select: {
        ...this.safeUserSelect(),
        courierProfile: {
          select: {
            id: true,
            city: true,
            vehicleType: true,
            vehicleModel: true,
            plate: true,
            profileImageKey: true
          }
        },
        storeLinks: {
          select: {
            id: true,
            status: true,
            requestedBy: true,
            approvedAt: true,
            rejectedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                status: true,
                active: true
              }
            }
          },
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    return couriers.map((courier) => ({
      ...courier,
      courierProfile: courier.courierProfile
        ? {
            ...courier.courierProfile,
            profileImageKey: undefined,
            profilePhotoUrl: courier.courierProfile.profileImageKey
              ? `/media/couriers/${courier.id}/profile-image`
              : null
          }
        : null
    }));
  }

  async updateCourierStatus(
    adminUserId: string,
    courierId: string,
    dto: UpdateAdminUserStatusDto
  ) {
    const courier = await this.prisma.user.findFirst({
      where: {
        id: courierId,
        role: PrismaUserRole.COURIER
      },
      select: { id: true }
    });

    if (!courier) {
      throw new NotFoundException("Motoboy nao encontrado");
    }

    return this.updateUserStatus(adminUserId, courierId, dto, {
      prefix: "COURIER",
      type: "COURIER"
    });
  }

  async blockCourierLink(
    adminUserId: string,
    courierId: string,
    linkId: string
  ) {
    const link = await this.prisma.storeCourierLink.findFirst({
      where: {
        id: linkId,
        courierId
      },
      select: { id: true, status: true, storeId: true }
    });

    if (!link) {
      throw new NotFoundException("Vinculo do motoboy nao encontrado");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextLink = await tx.storeCourierLink.update({
        where: { id: linkId },
        data: {
          status: StoreCourierLinkStatus.BLOCKED,
          approvedAt: null,
          rejectedAt: new Date()
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              status: true,
              active: true
            }
          },
          courier: {
            select: this.safeUserSelect()
          }
        }
      });

      await this.createAuditLog(tx, {
        adminUserId,
        action: "COURIER_LINK_BLOCKED",
        targetType: "STORE_COURIER_LINK",
        targetId: linkId,
        metadataJson: {
          courierId,
          storeId: link.storeId,
          previousStatus: link.status,
          nextStatus: StoreCourierLinkStatus.BLOCKED
        }
      });

      return nextLink;
    });

    return updated;
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    input: {
      adminUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
      metadataJson?: Prisma.InputJsonValue;
    }
  ) {
    await tx.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason?.trim() || null,
        metadataJson: input.metadataJson ?? Prisma.JsonNull
      }
    });
  }

  private statusAction(
    targetPrefix: "STORE" | "USER" | "COURIER",
    status: StoreStatus | UserStatus
  ) {
    if (status === "ACTIVE") {
      return `${targetPrefix}_ACTIVATED`;
    }

    if (status === "SUSPENDED") {
      return `${targetPrefix}_SUSPENDED`;
    }

    return `${targetPrefix}_INACTIVATED`;
  }

  private safeUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      active: true,
      createdAt: true,
      updatedAt: true
    } satisfies Prisma.UserSelect;
  }

  private serializeStore(store: {
    id: string;
    name: string;
    address: string;
    ownerUserId: string;
    status: StoreStatus;
    active: boolean;
    profileImageKey?: string | null;
    profileImageFileName?: string | null;
    profileImageMimeType?: string | null;
    profileImageSize?: number | null;
    profileImageUpdatedAt?: Date | null;
    pixKeyType?: unknown;
    pixKey?: string | null;
    pixRecipientName?: string | null;
    pixInstructions?: string | null;
    pixEnabled?: boolean;
    createdAt: Date;
    updatedAt: Date;
    owner: ReturnType<AdminService["safeUserSelect"]> extends infer T
      ? { [K in keyof T]: unknown }
      : never;
    _count?: Record<string, number>;
  }) {
    return {
      ...store,
      profileImageKey: undefined,
      imageUrl: store.profileImageKey ? `/media/stores/${store.id}/image` : null
    };
  }
}
