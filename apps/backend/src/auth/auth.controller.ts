import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("register/courier")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registerCourier(@Body() dto: RegisterCourierDto) {
    return this.authService.registerCourier(dto);
  }

  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
