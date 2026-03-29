import { Controller, Get, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
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
}
