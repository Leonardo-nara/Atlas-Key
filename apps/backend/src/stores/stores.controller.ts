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
import { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";
import { UpdateStorePixSettingsDto } from "./dto/update-store-pix-settings.dto";
import { StoresService } from "./stores.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller("stores")
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get("me")
  getMyStore(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.getStoreProfile(user.sub, user.role);
  }

  @Patch("me/image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: IMAGE_MAX_FILE_SIZE_BYTES
      }
    })
  )
  uploadMyStoreImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedStorageFile
  ) {
    return this.storesService.uploadStoreImage(user.sub, user.role, file);
  }

  @Delete("me/image")
  removeMyStoreImage(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.removeStoreImage(user.sub, user.role);
  }

  @Get("me/delivery-zones")
  listDeliveryZones(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.listDeliveryZones(user.sub, user.role);
  }

  @Get("me/pix-settings")
  getPixSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.getPixSettings(user.sub, user.role);
  }

  @Patch("me/pix-settings")
  updatePixSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStorePixSettingsDto
  ) {
    return this.storesService.updatePixSettings(user.sub, user.role, dto);
  }

  @Post("me/delivery-zones")
  createDeliveryZone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeliveryZoneDto
  ) {
    return this.storesService.createDeliveryZone(user.sub, user.role, dto);
  }

  @Patch("me/delivery-zones/:zoneId")
  updateDeliveryZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param("zoneId") zoneId: string,
    @Body() dto: UpdateDeliveryZoneDto
  ) {
    return this.storesService.updateDeliveryZone(user.sub, user.role, zoneId, dto);
  }

  @Delete("me/delivery-zones/:zoneId")
  deactivateDeliveryZone(
    @CurrentUser() user: AuthenticatedUser,
    @Param("zoneId") zoneId: string
  ) {
    return this.storesService.deactivateDeliveryZone(user.sub, user.role, zoneId);
  }
}

@Controller("media/stores")
export class StoreMediaController {
  constructor(private readonly storesService: StoresService) {}

  @Get(":storeId/image")
  async getStoreImage(
    @Param("storeId") storeId: string,
    @Res() response: StreamResponse & NodeJS.WritableStream
  ) {
    const file = await this.storesService.getStoreImage(storeId);

    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", file.size.toString());
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`
    );

    file.stream.pipe(response);
  }
}
