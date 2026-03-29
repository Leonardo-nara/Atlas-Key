import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto
  ) {
    return this.productsService.create(user.sub, user.role, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findAll(user.sub, user.role);
  }

  @Get(":productId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string
  ) {
    return this.productsService.findOne(user.sub, user.role, productId);
  }

  @Patch(":productId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto
  ) {
    return this.productsService.update(user.sub, user.role, productId, dto);
  }

  @Delete(":productId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string
  ) {
    return this.productsService.remove(user.sub, user.role, productId);
  }
}
