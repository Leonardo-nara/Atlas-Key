import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ReportListQueryDto, ReportPeriodQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  overview(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportPeriodQueryDto) {
    return this.reportsService.overview(user.sub, user.role, query);
  }

  @Get("sales")
  sales(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListQueryDto) {
    return this.reportsService.sales(user.sub, user.role, query);
  }

  @Get("products")
  products(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportPeriodQueryDto) {
    return this.reportsService.products(user.sub, user.role, query);
  }

  @Get("payments")
  payments(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportPeriodQueryDto) {
    return this.reportsService.payments(user.sub, user.role, query);
  }

  @Get("cash")
  cash(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListQueryDto) {
    return this.reportsService.cash(user.sub, user.role, query);
  }

  @Get("stock")
  stock(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListQueryDto) {
    return this.reportsService.stock(user.sub, user.role, query);
  }

  @Get("sales.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async salesCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    const csv = await this.reportsService.salesCsv(user.sub, user.role, query);
    response.setHeader("Content-Disposition", `attachment; filename="${csv.fileName}"`);
    return csv.content;
  }

  @Get("products.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async productsCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportPeriodQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    const csv = await this.reportsService.productsCsv(user.sub, user.role, query);
    response.setHeader("Content-Disposition", `attachment; filename="${csv.fileName}"`);
    return csv.content;
  }

  @Get("cash.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async cashCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    const csv = await this.reportsService.cashCsv(user.sub, user.role, query);
    response.setHeader("Content-Disposition", `attachment; filename="${csv.fileName}"`);
    return csv.content;
  }

  @Get("stock.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async stockCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse
  ) {
    const csv = await this.reportsService.stockCsv(user.sub, user.role, query);
    response.setHeader("Content-Disposition", `attachment; filename="${csv.fileName}"`);
    return csv.content;
  }
}
