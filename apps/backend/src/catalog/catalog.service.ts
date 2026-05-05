import { Injectable, NotFoundException } from "@nestjs/common";
import { StoreStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listStores(search?: string) {
    const normalizedSearch = search?.trim();

    return this.prisma.store.findMany({
      where: {
        active: true,
        status: StoreStatus.ACTIVE,
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
        profileImageKey: true,
        profileImageFileName: true,
        profileImageMimeType: true,
        profileImageSize: true,
        profileImageUpdatedAt: true,
        createdAt: true,
        updatedAt: true
      }
    }).then((stores) => stores.map((store) => this.serializeStore(store)));
  }

  async listProductsByStore(storeId: string, search?: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        active: true,
        status: StoreStatus.ACTIVE
      },
      select: {
        id: true,
        name: true,
        address: true,
        active: true,
        profileImageKey: true,
        profileImageFileName: true,
        profileImageMimeType: true,
        profileImageSize: true,
        profileImageUpdatedAt: true,
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
      store: this.serializeStore(store),
      products: products.map((product) => ({
        ...product,
        imageKey: undefined,
        imageUrl: product.imageKey
          ? `/media/products/${product.id}/image`
          : product.imageUrl,
        price: Number(product.price)
      }))
    };
  }

  private serializeStore(store: {
    id: string;
    name: string;
    address: string;
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
}
