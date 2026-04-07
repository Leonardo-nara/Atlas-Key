import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { RequestStoreLinkDto } from "./dto/request-store-link.dto";
import { StoreCourierLinksService } from "./store-courier-links.service";

@Controller("store-links")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreCourierLinksController {
  constructor(
    private readonly storeCourierLinksService: StoreCourierLinksService
  ) {}

  @Get("stores")
  @Roles(UserRole.COURIER)
  listAvailableStores(@CurrentUser() user: AuthenticatedUser) {
    return this.storeCourierLinksService.listAvailableStoresForCourier(user.sub);
  }

  @Post("request")
  @Roles(UserRole.COURIER)
  requestLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestStoreLinkDto
  ) {
    return this.storeCourierLinksService.requestByCourier(user.sub, dto.storeId);
  }

  @Get("my")
  @Roles(UserRole.COURIER)
  listMyLinks(@CurrentUser() user: AuthenticatedUser) {
    return this.storeCourierLinksService.listCourierLinks(user.sub);
  }

  @Get("requests")
  @Roles(UserRole.STORE_ADMIN)
  listReceivedRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.storeCourierLinksService.listStoreRequests(user.sub);
  }

  @Patch(":linkId/approve")
  @Roles(UserRole.STORE_ADMIN)
  approveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("linkId") linkId: string
  ) {
    return this.storeCourierLinksService.approveLink(user.sub, linkId);
  }

  @Patch(":linkId/reject")
  @Roles(UserRole.STORE_ADMIN)
  rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("linkId") linkId: string
  ) {
    return this.storeCourierLinksService.rejectLink(user.sub, linkId);
  }

  @Get("couriers")
  @Roles(UserRole.STORE_ADMIN)
  listStoreCouriers(@CurrentUser() user: AuthenticatedUser) {
    return this.storeCourierLinksService.listApprovedCouriers(user.sub);
  }
}
