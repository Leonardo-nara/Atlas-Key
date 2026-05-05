import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CouriersService } from "../couriers/couriers.service";
import { UpdateClientAddressDto } from "./dto/update-client-address.dto";

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
        courierProfile: true,
        clientAddress: true
      }
    });

    if (!user || !user.active || user.status !== UserStatus.ACTIVE) {
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
      status: user.status,
      active: user.active,
      clientAddress: user.clientAddress
        ? this.serializeClientAddress(user.clientAddress)
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async getClientAddress(userId: string) {
    await this.ensureClient(userId);

    const address = await this.prisma.clientAddress.findUnique({
      where: { userId }
    });

    return address ? this.serializeClientAddress(address) : null;
  }

  async upsertClientAddress(userId: string, dto: UpdateClientAddressDto) {
    await this.ensureClient(userId);

    const address = await this.prisma.clientAddress.upsert({
      where: { userId },
      create: {
        userId,
        street: dto.street,
        number: dto.number,
        district: dto.district,
        complement: dto.complement,
        city: dto.city,
        reference: dto.reference
      },
      update: {
        street: dto.street,
        number: dto.number,
        district: dto.district,
        complement: dto.complement,
        city: dto.city,
        reference: dto.reference
      }
    });

    return this.serializeClientAddress(address);
  }

  private async ensureClient(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true, status: true }
    });

    if (!user || !user.active || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException("Endereco salvo esta disponivel apenas para clientes");
    }
  }

  private serializeClientAddress(address: {
    id: string;
    street: string;
    number: string;
    district: string;
    complement: string | null;
    city: string;
    reference: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: address.id,
      street: address.street,
      number: address.number,
      district: address.district,
      complement: address.complement,
      city: address.city,
      reference: address.reference,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt
    };
  }
}
