import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        active: true
      }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Sessao invalida");
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole
    };
  }
}
