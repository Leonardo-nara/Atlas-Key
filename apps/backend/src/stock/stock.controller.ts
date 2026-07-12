import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements-query.dto";
import { ListStockProductsQueryDto } from "./dto/list-stock-products-query.dto";
import { UpdateStockSettingsDto } from "./dto/update-stock-settings.dto";
import { StockService } from "./stock.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("products") listProducts(@CurrentUser() user: AuthenticatedUser, @Query() query: ListStockProductsQueryDto) {
    return this.stockService.listProducts(user.sub, user.role, query);
  }
  @Get("products/:productId") getProduct(@CurrentUser() user: AuthenticatedUser, @Param("productId") productId: string) {
    return this.stockService.getProduct(user.sub, user.role, productId);
  }
  @Patch("products/:productId/settings") updateSettings(@CurrentUser() user: AuthenticatedUser, @Param("productId") productId: string, @Body() dto: UpdateStockSettingsDto) {
    return this.stockService.updateSettings(user.sub, user.role, productId, dto);
  }
  @Post("products/:productId/movements") createMovement(@CurrentUser() user: AuthenticatedUser, @Param("productId") productId: string, @Body() dto: CreateStockMovementDto) {
    return this.stockService.createMovement(user.sub, user.role, productId, dto);
  }
  @Get("movements") listMovements(@CurrentUser() user: AuthenticatedUser, @Query() query: ListStockMovementsQueryDto) {
    return this.stockService.listMovements(user.sub, user.role, query);
  }
  @Get("summary") summary(@CurrentUser() user: AuthenticatedUser) {
    return this.stockService.getSummary(user.sub, user.role);
  }
}
