import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RegisterDeviceTokenDto } from "./dto/register-device-token.dto";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtAuthGuard)
@Controller("notifications/devices")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listDevices(user.sub);
  }

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto
  ) {
    return this.notificationsService.registerDevice(user.sub, dto);
  }

  @Delete()
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.removeAllDevices(user.sub);
  }

  @Delete(":deviceId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("deviceId") deviceId: string) {
    return this.notificationsService.removeDevice(user.sub, deviceId);
  }
}
