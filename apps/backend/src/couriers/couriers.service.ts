import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CourierProfile,
  CourierVehicleType,
  Prisma,
  User,
  UserRole,
  UserStatus
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { ImageStorageService } from "../common/storage/image-storage.service";
import type { UploadedFile } from "../common/storage/uploaded-file.interface";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { UpdateCourierProfileDto } from "./dto/update-courier-profile.dto";

type CourierUserWithProfile = User & {
  courierProfile: CourierProfile | null;
};

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorageService: ImageStorageService
  ) {}

  async createPublicCourier(dto: RegisterCourierDto, passwordHash: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new BadRequestException("Email ja cadastrado");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail,
          passwordHash,
          phone: dto.phone.trim(),
          role: UserRole.COURIER,
          status: UserStatus.ACTIVE,
          active: true
        }
      });

      await tx.courierProfile.create({
        data: {
          userId: createdUser.id,
          ...this.buildProfileCreateData(dto)
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: {
          courierProfile: true
        }
      });
    });

    return this.serializeCourierUser(user);
  }

  async ensureCourierProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        courierProfile: true
      }
    });

    if (!user || !user.active || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException("Motoboy nao encontrado");
    }

    if (user.role !== UserRole.COURIER) {
      throw new BadRequestException("Usuario autenticado nao e um motoboy");
    }

    if (!user.courierProfile) {
      return this.prisma.courierProfile.create({
        data: {
          userId: user.id
        }
      });
    }

    return user.courierProfile;
  }

  async getMe(userId: string) {
    await this.ensureCourierProfile(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        courierProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException("Motoboy nao encontrado");
    }

    return this.serializeCourierUser(user);
  }

  async updateMe(userId: string, dto: UpdateCourierProfileDto) {
    await this.ensureCourierProfile(userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.name || dto.phone) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.phone ? { phone: dto.phone.trim() } : {})
          }
        });
      }

      await tx.courierProfile.update({
        where: { userId },
        data: this.buildProfileUpdateData(dto)
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          courierProfile: true
        }
      });
    });

    return this.serializeCourierUser(updated);
  }

  async uploadProfileImage(userId: string, file: UploadedFile) {
    const profile = await this.ensureCourierProfile(userId);
    const storedImage = await this.imageStorageService.saveImage(
      `couriers/${userId}/profile`,
      file
    );

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.courierProfile.update({
        where: { userId },
        data: {
          profileImageKey: storedImage.storageKey,
          profileImageFileName: storedImage.originalFileName,
          profileImageMimeType: storedImage.mimeType,
          profileImageSize: storedImage.size,
          profileImageUpdatedAt: new Date(),
          profilePhotoUrl: null
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          courierProfile: true
        }
      });
    });

    await this.imageStorageService.deleteImage(profile.profileImageKey);

    return this.serializeCourierUser(updatedUser);
  }

  async removeProfileImage(userId: string) {
    const profile = await this.ensureCourierProfile(userId);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.courierProfile.update({
        where: { userId },
        data: {
          profileImageKey: null,
          profileImageFileName: null,
          profileImageMimeType: null,
          profileImageSize: null,
          profileImageUpdatedAt: null,
          profilePhotoUrl: null
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          courierProfile: true
        }
      });
    });

    await this.imageStorageService.deleteImage(profile.profileImageKey);

    return this.serializeCourierUser(updatedUser);
  }

  async getProfileImage(
    requesterUserId: string,
    requesterRole: UserRole,
    courierId: string
  ) {
    if (requesterRole === UserRole.COURIER && requesterUserId !== courierId) {
      throw new ForbiddenException("Motoboy nao pode acessar foto de outro motoboy");
    }

    if (requesterRole === UserRole.STORE_ADMIN) {
      const allowedLink = await this.prisma.storeCourierLink.findFirst({
        where: {
          courierId,
          store: {
            ownerUserId: requesterUserId
          }
        },
        select: { id: true }
      });

      if (!allowedLink) {
        throw new ForbiddenException("Motoboy nao vinculado a loja autenticada");
      }
    }

    if (
      requesterRole !== UserRole.COURIER &&
      requesterRole !== UserRole.STORE_ADMIN
    ) {
      throw new ForbiddenException("Perfil sem acesso a foto do motoboy");
    }

    const profile = await this.prisma.courierProfile.findUnique({
      where: { userId: courierId },
      select: {
        profileImageKey: true,
        profileImageFileName: true,
        profileImageMimeType: true,
        profileImageSize: true
      }
    });

    if (!profile?.profileImageKey || !profile.profileImageFileName || !profile.profileImageMimeType || !profile.profileImageSize) {
      throw new NotFoundException("Foto do motoboy nao encontrada");
    }

    return this.imageStorageService.readImage(profile.profileImageKey, {
      fileName: profile.profileImageFileName,
      mimeType: profile.profileImageMimeType,
      size: profile.profileImageSize
    });
  }

  private buildProfileCreateData(
    dto: Pick<
      RegisterCourierDto | UpdateCourierProfileDto,
      | "profilePhotoUrl"
      | "vehiclePhotoUrl"
      | "vehicleType"
      | "vehicleModel"
      | "plate"
      | "city"
    >
  ): Omit<Prisma.CourierProfileUncheckedCreateInput, "userId"> {
    return {
      ...(dto.profilePhotoUrl !== undefined ? { profilePhotoUrl: dto.profilePhotoUrl } : {}),
      ...(dto.vehiclePhotoUrl !== undefined ? { vehiclePhotoUrl: dto.vehiclePhotoUrl } : {}),
      ...(dto.vehicleType !== undefined ? { vehicleType: dto.vehicleType as CourierVehicleType } : {}),
      ...(dto.vehicleModel !== undefined ? { vehicleModel: dto.vehicleModel } : {}),
      ...(dto.plate !== undefined ? { plate: dto.plate } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {})
    };
  }

  private buildProfileUpdateData(
    dto: Pick<
      RegisterCourierDto | UpdateCourierProfileDto,
      | "profilePhotoUrl"
      | "vehiclePhotoUrl"
      | "vehicleType"
      | "vehicleModel"
      | "plate"
      | "city"
    >
  ): Prisma.CourierProfileUncheckedUpdateInput {
    return {
      ...(dto.profilePhotoUrl !== undefined ? { profilePhotoUrl: dto.profilePhotoUrl } : {}),
      ...(dto.vehiclePhotoUrl !== undefined ? { vehiclePhotoUrl: dto.vehiclePhotoUrl } : {}),
      ...(dto.vehicleType !== undefined ? { vehicleType: dto.vehicleType as CourierVehicleType } : {}),
      ...(dto.vehicleModel !== undefined ? { vehicleModel: dto.vehicleModel } : {}),
      ...(dto.plate !== undefined ? { plate: dto.plate } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {})
    };
  }

  private serializeCourierUser(user: CourierUserWithProfile) {
    const profile = user.courierProfile;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileCompleted: this.isProfileCompleted(profile),
      courierProfile: profile
        ? {
            id: profile.id,
            profilePhotoUrl: profile.profileImageKey
              ? `/media/couriers/${user.id}/profile-image`
              : profile.profilePhotoUrl,
            profileImageFileName: profile.profileImageFileName,
            profileImageMimeType: profile.profileImageMimeType,
            profileImageSize: profile.profileImageSize,
            profileImageUpdatedAt: profile.profileImageUpdatedAt,
            vehiclePhotoUrl: profile.vehiclePhotoUrl,
            vehicleType: profile.vehicleType,
            vehicleModel: profile.vehicleModel,
            plate: profile.plate,
            city: profile.city,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
          }
        : null
    };
  }

  private isProfileCompleted(profile: CourierProfile | null) {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.city &&
        profile.vehicleType &&
        profile.vehicleModel &&
        profile.plate
    );
  }
}
