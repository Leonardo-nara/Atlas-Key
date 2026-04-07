import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CourierProfile,
  CourierVehicleType,
  Prisma,
  User,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { UpdateCourierProfileDto } from "./dto/update-courier-profile.dto";

type CourierUserWithProfile = User & {
  courierProfile: CourierProfile | null;
};

@Injectable()
export class CouriersService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (!user) {
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
            profilePhotoUrl: profile.profilePhotoUrl,
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
