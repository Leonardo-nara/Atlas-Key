import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
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
    return this.storesService.getStoreByOwner(user.sub, user.role);
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
