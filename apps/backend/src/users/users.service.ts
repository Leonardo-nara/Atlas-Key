import { Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CouriersService } from "../couriers/couriers.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couriersService: CouriersService
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        courierProfile: true
      }
    });

    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (user.role === UserRole.COURIER) {
      return this.couriersService.getMe(userId);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
