import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

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
}
