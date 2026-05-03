import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { ImageStorageService } from "../common/storage/image-storage.service";
import type { UploadedFile } from "../common/storage/uploaded-file.interface";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly imageStorageService: ImageStorageService
  ) {}

  async create(ownerUserId: string, role: UserRole, dto: CreateProductDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);

    const product = await this.prisma.product.create({
      data: {
        storeId: store.id,
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        category: dto.category,
        imageUrl: dto.imageUrl,
        available: dto.available ?? true
      }
    });

    return this.serializeProduct(product);
  }

  async findAll(ownerUserId: string, role: UserRole) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const products = await this.prisma.product.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" }
    });

    return products.map((product) => this.serializeProduct(product));
  }

  async findOne(ownerUserId: string, role: UserRole, productId: string) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);

    return this.serializeProduct(product);
  }

  async update(
    ownerUserId: string,
    role: UserRole,
    productId: string,
    dto: UpdateProductDto
  ) {
    const existingProduct = await this.findOwnedProduct(ownerUserId, role, productId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        description: dto.description,
        price:
          dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        category: dto.category,
        imageUrl: dto.imageUrl,
        ...(dto.imageUrl !== undefined
          ? {
              imageKey: null,
              imageFileName: null,
              imageMimeType: null,
              imageSize: null,
              imageUpdatedAt: null
            }
          : {}),
        available: dto.available
      }
    });

    if (dto.imageUrl !== undefined) {
      await this.imageStorageService.deleteImage(existingProduct.imageKey);
    }

    return this.serializeProduct(product);
  }

  async remove(ownerUserId: string, role: UserRole, productId: string) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);
    await this.prisma.product.delete({
      where: { id: productId }
    });
    await this.imageStorageService.deleteImage(product.imageKey);

    return {
      message: "Produto removido com sucesso"
    };
  }

  async uploadImage(
    ownerUserId: string,
    role: UserRole,
    productId: string,
    file: UploadedFile
  ) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);
    const storedImage = await this.imageStorageService.saveImage(
      `products/${product.id}`,
      file
    );

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        imageKey: storedImage.storageKey,
        imageFileName: storedImage.originalFileName,
        imageMimeType: storedImage.mimeType,
        imageSize: storedImage.size,
        imageUpdatedAt: new Date(),
        imageUrl: null
      }
    });

    await this.imageStorageService.deleteImage(product.imageKey);

    return this.serializeProduct(updatedProduct);
  }

  async removeImage(ownerUserId: string, role: UserRole, productId: string) {
    const product = await this.findOwnedProduct(ownerUserId, role, productId);

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        imageKey: null,
        imageFileName: null,
        imageMimeType: null,
        imageSize: null,
        imageUpdatedAt: null,
        imageUrl: null
      }
    });

    await this.imageStorageService.deleteImage(product.imageKey);

    return this.serializeProduct(updatedProduct);
  }

  async getProductImage(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        available: true,
        store: {
          active: true
        }
      },
      select: {
        imageKey: true,
        imageFileName: true,
        imageMimeType: true,
        imageSize: true
      }
    });

    if (!product?.imageKey || !product.imageFileName || !product.imageMimeType || !product.imageSize) {
      throw new NotFoundException("Imagem do produto nao encontrada");
    }

    return this.imageStorageService.readImage(product.imageKey, {
      fileName: product.imageFileName,
      mimeType: product.imageMimeType,
      size: product.imageSize
    });
  }

  private async findOwnedProduct(
    ownerUserId: string,
    role: UserRole,
    productId: string
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundException("Produto nao encontrado");
    }

    if (product.storeId !== store.id) {
      throw new ForbiddenException("Produto nao pertence a loja autenticada");
    }

    return product;
  }

  private serializeProduct(
    product: Prisma.ProductGetPayload<Record<string, never>>
  ) {
    return {
      ...product,
      imageKey: undefined,
      imageUrl: product.imageKey
        ? `/media/products/${product.id}/image`
        : product.imageUrl,
      price: Number(product.price)
    };
  }
}
