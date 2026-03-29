import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
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

    return this.serializeProduct(product);
  }

  async update(
    ownerUserId: string,
    role: UserRole,
    productId: string,
    dto: UpdateProductDto
  ) {
    await this.findOne(ownerUserId, role, productId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        description: dto.description,
        price:
          dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        category: dto.category,
        imageUrl: dto.imageUrl,
        available: dto.available
      }
    });

    return this.serializeProduct(product);
  }

  async remove(ownerUserId: string, role: UserRole, productId: string) {
    await this.findOne(ownerUserId, role, productId);
    await this.prisma.product.delete({
      where: { id: productId }
    });

    return {
      message: "Produto removido com sucesso"
    };
  }

  private serializeProduct(
    product: Prisma.ProductGetPayload<Record<string, never>>
  ) {
    return {
      ...product,
      price: Number(product.price)
    };
  }
}
