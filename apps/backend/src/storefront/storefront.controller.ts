import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { StorefrontCheckoutDto } from "./dto/storefront-checkout.dto";
import { UpdateStorefrontSettingsDto } from "./dto/update-storefront-settings.dto";
import { StorefrontService } from "./storefront.service";

@Controller("storefront")
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get("stores/:slug")
  getStore(@Param("slug") slug: string) {
    return this.storefrontService.getPublicStore(slug);
  }

  @Get("stores/:slug/delivery-fee")
  getDeliveryFee(
    @Param("slug") slug: string,
    @Query("district") district?: string,
    @Query("fulfillmentType") fulfillmentType?: string
  ) {
    return this.storefrontService.getDeliveryFee(slug, district, fulfillmentType);
  }

  @Post("stores/:slug/checkout")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  checkout(@Param("slug") slug: string, @Body() dto: StorefrontCheckoutDto) {
    return this.storefrontService.checkout(slug, dto);
  }

  @Get("orders/:trackingToken")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getOrder(@Param("trackingToken") trackingToken: string) {
    return this.storefrontService.getPublicOrder(trackingToken);
  }
}

@Controller("stores/me/storefront")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
export class StorefrontAdminController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.storefrontService.getStorefrontSettings(user.sub, user.role);
  }

  @Patch()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStorefrontSettingsDto
  ) {
    return this.storefrontService.updateStorefrontSettings(user.sub, user.role, dto);
  }
}
