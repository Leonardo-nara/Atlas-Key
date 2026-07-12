import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CashRegistersService } from "./cash-registers.service";
import { CashMovementDto } from "./dto/cash-movement.dto";
import { CloseCashRegisterSessionDto } from "./dto/close-cash-register-session.dto";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { ListCashRegisterSessionsQueryDto } from "./dto/list-cash-register-sessions-query.dto";
import { OpenCashRegisterDto } from "./dto/open-cash-register.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STORE_ADMIN)
@Controller()
export class CashRegistersController {
  constructor(private readonly cashRegistersService: CashRegistersService) {}

  @Post("cash-registers")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCashRegisterDto) {
    return this.cashRegistersService.create(user.sub, user.role, dto);
  }

  @Get("cash-registers")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cashRegistersService.list(user.sub, user.role);
  }

  @Patch("cash-registers/:cashRegisterId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("cashRegisterId") cashRegisterId: string,
    @Body() dto: UpdateCashRegisterDto
  ) {
    return this.cashRegistersService.update(user.sub, user.role, cashRegisterId, dto);
  }

  @Post("cash-registers/:cashRegisterId/open")
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Param("cashRegisterId") cashRegisterId: string,
    @Body() dto: OpenCashRegisterDto
  ) {
    return this.cashRegistersService.open(user.sub, user.role, cashRegisterId, dto);
  }

  @Get("cash-registers/:cashRegisterId/current-session")
  currentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("cashRegisterId") cashRegisterId: string
  ) {
    return this.cashRegistersService.getCurrentSession(user.sub, user.role, cashRegisterId);
  }

  @Get("cash-register-sessions")
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCashRegisterSessionsQueryDto
  ) {
    return this.cashRegistersService.listSessions(user.sub, user.role, query);
  }

  @Get("cash-register-sessions/:sessionId")
  findSession(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.cashRegistersService.findSession(user.sub, user.role, sessionId);
  }

  @Post("cash-register-sessions/:sessionId/cash-in")
  cashIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: CashMovementDto
  ) {
    return this.cashRegistersService.cashIn(user.sub, user.role, sessionId, dto);
  }

  @Post("cash-register-sessions/:sessionId/cash-out")
  cashOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: CashMovementDto
  ) {
    return this.cashRegistersService.cashOut(user.sub, user.role, sessionId, dto);
  }

  @Post("cash-register-sessions/:sessionId/close")
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: CloseCashRegisterSessionDto
  ) {
    return this.cashRegistersService.close(user.sub, user.role, sessionId, dto);
  }

  @Get("cash-register-sessions/:sessionId/report")
  report(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.cashRegistersService.report(user.sub, user.role, sessionId);
  }
}
