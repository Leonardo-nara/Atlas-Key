import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { IMAGE_MAX_FILE_SIZE_BYTES } from "../common/storage/image-storage.service";
import type {
  StreamResponse,
  UploadedFile as UploadedStorageFile
} from "../common/storage/uploaded-file.interface";
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

  @Patch(":productId/image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: IMAGE_MAX_FILE_SIZE_BYTES
      }
    })
  )
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string,
    @UploadedFile() file: UploadedStorageFile
  ) {
    return this.productsService.uploadImage(user.sub, user.role, productId, file);
  }

  @Delete(":productId/image")
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string
  ) {
    return this.productsService.removeImage(user.sub, user.role, productId);
  }

  @Delete(":productId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("productId") productId: string
  ) {
    return this.productsService.remove(user.sub, user.role, productId);
  }
}

@Controller("media/products")
export class ProductMediaController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(":productId/image")
  async getProductImage(
    @Param("productId") productId: string,
    @Res() response: StreamResponse & NodeJS.WritableStream
  ) {
    const file = await this.productsService.getProductImage(productId);

    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", file.size.toString());
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`
    );

    file.stream.pipe(response);
  }
}
