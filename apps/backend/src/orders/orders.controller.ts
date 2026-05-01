import {
  Body,
  Controller,
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
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { ConfirmOrderDto } from "./dto/confirm-order.dto";
import { CreateClientOrderDto } from "./dto/create-client-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { ReviewPaymentProofDto } from "./dto/review-payment-proof.dto";
import { SubmitPaymentProofDto } from "./dto/submit-payment-proof.dto";
import { UpdateCourierOrderStatusDto } from "./dto/update-courier-order-status.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto
  ) {
    return this.ordersService.create(user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @Post("client")
  createClientOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientOrderDto
  ) {
    return this.ordersService.createClientOrder(user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @Get("client/my")
  listClientOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto
  ) {
    return this.ordersService.listClientOrders(user.sub, user.role, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto
  ) {
    return this.ordersService.list(user.sub, user.role, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Patch(":orderId/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: ConfirmOrderDto
  ) {
    return this.ordersService.confirmOrder(orderId, user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Get(":orderId/history")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string
  ) {
    return this.ordersService.getHistory(orderId, user.sub, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Patch(":orderId/payment-proof/approve")
  approvePaymentProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: ReviewPaymentProofDto
  ) {
    return this.ordersService.approvePaymentProof(orderId, user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Patch(":orderId/payment-proof/reject")
  rejectPaymentProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: ReviewPaymentProofDto
  ) {
    return this.ordersService.rejectPaymentProof(orderId, user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @Patch(":orderId/payment-proof")
  submitPaymentProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: SubmitPaymentProofDto
  ) {
    return this.ordersService.submitPaymentProof(orderId, user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Patch(":orderId/payment/paid")
  markPaymentPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string
  ) {
    return this.ordersService.markManualPaymentPaid(orderId, user.sub, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STORE_ADMIN)
  @Patch(":orderId/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: CancelOrderDto
  ) {
    return this.ordersService.cancelOrder(orderId, user.sub, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER)
  @Get("available")
  listAvailable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto
  ) {
    return this.ordersService.listAvailableForCourier(user.sub, user.role, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER)
  @Get("my")
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto
  ) {
    return this.ordersService.listCourierOrders(user.sub, user.role, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER)
  @Patch(":orderId/accept")
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string
  ) {
    return this.ordersService.acceptOrder(orderId, user.sub, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COURIER)
  @Patch(":orderId/status")
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateCourierOrderStatusDto
  ) {
    return this.ordersService.updateCourierOrderStatus(
      orderId,
      user.sub,
      user.role,
      dto
    );
  }
}
