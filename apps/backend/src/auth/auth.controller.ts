import { Body, Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AuthRequestContext, AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { RegisterDto } from "./dto/register.dto";

interface RequestLike {
  ip?: string;
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

  private getRequestContext(request: RequestLike): AuthRequestContext {
    const userAgent = request.headers["user-agent"];

    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent
    };
  }
}
