import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AddSaleItemDto } from "./dto/add-sale-item.dto";
import { CancelSaleDto } from "./dto/cancel-sale.dto";
import { CompleteSaleDto } from "./dto/complete-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { UpdateSaleItemDto } from "./dto/update-sale-item.dto";
import { SalesService } from "./sales.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller("sales")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.sub, user.role, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSalesQueryDto) {
    return this.salesService.list(user.sub, user.role, query);
  }

  @Get(":saleId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("saleId") saleId: string) {
    return this.salesService.findOne(user.sub, user.role, saleId);
  }

  @Post(":saleId/items")
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Body() dto: AddSaleItemDto
  ) {
    return this.salesService.addItem(user.sub, user.role, saleId, dto);
  }

  @Patch(":saleId/items/:itemId")
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateSaleItemDto
  ) {
    return this.salesService.updateItem(user.sub, user.role, saleId, itemId, dto);
  }

  @Delete(":saleId/items/:itemId")
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Param("itemId") itemId: string
  ) {
    return this.salesService.removeItem(user.sub, user.role, saleId, itemId);
  }

  @Patch(":saleId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Body() dto: UpdateSaleDto
  ) {
    return this.salesService.update(user.sub, user.role, saleId, dto);
  }

  @Post(":saleId/complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Body() dto: CompleteSaleDto
  ) {
    return this.salesService.complete(user.sub, user.role, saleId, dto);
  }

  @Post(":saleId/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("saleId") saleId: string,
    @Body() dto: CancelSaleDto
  ) {
    return this.salesService.cancel(user.sub, user.role, saleId, dto);
  }

  @Get(":saleId/receipt")
  receipt(@CurrentUser() user: AuthenticatedUser, @Param("saleId") saleId: string) {
    return this.salesService.receipt(user.sub, user.role, saleId);
  }
}
