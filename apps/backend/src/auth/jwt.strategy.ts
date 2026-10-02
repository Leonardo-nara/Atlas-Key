import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { validateAccessSession } from "./validate-access-session";

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const secret = configService.get<string>("JWT_SECRET");

    if (!secret) {
      throw new UnauthorizedException("JWT_SECRET nao configurado");
    }

    if (process.env.NODE_ENV === "production" && secret.length < 32) {
      throw new UnauthorizedException("JWT_SECRET precisa ter pelo menos 32 caracteres em producao");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return validateAccessSession(this.prisma, payload);
  }
}
