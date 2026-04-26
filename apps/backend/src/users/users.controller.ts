import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UpdateClientAddressDto } from "./dto/update-client-address.dto";
import { UsersService } from "./users.service";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.sub);
  }

  @Get("me/address")
  getMyAddress(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getClientAddress(user.sub);
  }

  @Patch("me/address")
  updateMyAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientAddressDto
  ) {
    return this.usersService.upsertClientAddress(user.sub, dto);
  }
}
