import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AuthRequestContext, AuthService } from "./auth.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { GoogleMobileAuthDto } from "./dto/google-mobile-auth.dto";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterStoreQuickDto } from "./dto/register-store-quick.dto";
import type { AuthenticatedUser } from "../common/authenticated-user.interface";

interface RequestLike {
  ip?: string;
  requestId?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() request: RequestLike) {
    return this.authService.register(dto, this.getRequestContext(request));
  }

  @Post("register/store")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registerStoreQuick(@Body() dto: RegisterStoreQuickDto, @Req() request: RequestLike) {
    return this.authService.registerStoreQuick(dto, this.getRequestContext(request));
  }

  @Post("register/courier")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registerCourier(@Body() dto: RegisterCourierDto, @Req() request: RequestLike) {
    return this.authService.registerCourier(dto, this.getRequestContext(request));
  }

  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() request: RequestLike) {
    return this.authService.login(dto, this.getRequestContext(request));
  }

  @Post("login/google/mobile")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  loginWithGoogleMobile(
    @Body() dto: GoogleMobileAuthDto,
    @Req() request: RequestLike
  ) {
    return this.authService.loginWithGoogleMobile(
      dto,
      this.getRequestContext(request)
    );
  }

  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: RequestLike) {
    return this.authService.refresh(dto, this.getRequestContext(request));
  }

  @Post("logout")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  logout(@Body() dto: RefreshTokenDto, @Req() request: RequestLike) {
    return this.authService.logout(dto, this.getRequestContext(request));
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listActiveSessions(user);
  }

  @Post("sessions/current/logout")
  @UseGuards(JwtAuthGuard)
  logoutCurrentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestLike
  ) {
    return this.authService.logoutCurrentSession(
      user,
      this.getRequestContext(request)
    );
  }

  @Post("sessions/logout-all")
  @UseGuards(JwtAuthGuard)
  logoutAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: RequestLike
  ) {
    return this.authService.logoutAllSessions(user, this.getRequestContext(request));
  }

  @Post("sessions/:sessionId/revoke")
  @UseGuards(JwtAuthGuard)
  revokeOwnSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Req() request: RequestLike
  ) {
    return this.authService.revokeOwnSession(
      user,
      sessionId,
      this.getRequestContext(request)
    );
  }

  private getRequestContext(request: RequestLike): AuthRequestContext {
    const userAgent = request.headers["user-agent"];

    return {
      requestId: request.requestId,
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent
    };
  }
}
