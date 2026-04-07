import { Controller, Get, Patch, UseGuards, Body } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CouriersService } from "./couriers.service";
import { UpdateCourierProfileDto } from "./dto/update-courier-profile.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COURIER)
@Controller("couriers")
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.couriersService.getMe(user.sub);
  }

  @Patch("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierProfileDto
  ) {
    return this.couriersService.updateMe(user.sub, dto);
  }
}
