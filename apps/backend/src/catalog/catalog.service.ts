import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listStores(search?: string) {
    const normalizedSearch = search?.trim();

    return this.prisma.store.findMany({
      where: {
        active: true,
        ...(normalizedSearch
          ? {
              OR: [
                { name: { contains: normalizedSearch, mode: "insensitive" } },
                { address: { contains: normalizedSearch, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        address: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async listProductsByStore(storeId: string, search?: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        active: true
      },
      select: {
        id: true,
        name: true,
        address: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!store) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    const normalizedSearch = search?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        available: true,
        ...(normalizedSearch
          ? {
              OR: [
                { name: { contains: normalizedSearch, mode: "insensitive" } },
                { category: { contains: normalizedSearch, mode: "insensitive" } },
                { description: { contains: normalizedSearch, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    return {
      store,
      products: products.map((product) => ({
        ...product,
        price: Number(product.price)
      }))
    };
  }
}
