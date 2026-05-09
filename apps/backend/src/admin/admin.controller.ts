import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminService } from "./admin.service";
import { CreateAdminStoreDto } from "./dto/create-admin-store.dto";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { ListAdminAuditLogsQueryDto } from "./dto/list-admin-audit-logs-query.dto";
import { UpdateAdminStoreStatusDto } from "./dto/update-admin-store-status.dto";
import { UpdateAdminUserStatusDto } from "./dto/update-admin-user-status.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("audit-logs")
  listAuditLogs(@Query() query: ListAdminAuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  @Get("stores")
  listStores() {
    return this.adminService.listStores();
  }

  @Get("stores/:storeId")
  getStore(@Param("storeId") storeId: string) {
    return this.adminService.getStore(storeId);
  }

  @Post("stores")
  createStore(@Body() dto: CreateAdminStoreDto) {
    return this.adminService.createStore(dto);
  }

  @Patch("stores/:storeId/status")
  updateStoreStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateAdminStoreStatusDto
  ) {
    return this.adminService.updateStoreStatus(user.sub, storeId, dto);
  }

  @Get("users")
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get("users/:userId")
  getUser(@Param("userId") userId: string) {
    return this.adminService.getUser(userId);
  }

  @Post("users")
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch("users/:userId/status")
  updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateAdminUserStatusDto
  ) {
    return this.adminService.updateUserStatus(user.sub, userId, dto);
  }

  @Get("couriers")
  listCouriers() {
    return this.adminService.listCouriers();
  }

  @Patch("couriers/:courierId/status")
  updateCourierStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courierId") courierId: string,
    @Body() dto: UpdateAdminUserStatusDto
  ) {
    return this.adminService.updateCourierStatus(user.sub, courierId, dto);
  }

  @Delete("couriers/:courierId/links/:linkId")
  blockCourierLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courierId") courierId: string,
    @Param("linkId") linkId: string
  ) {
    return this.adminService.blockCourierLink(user.sub, courierId, linkId);
  }
}
