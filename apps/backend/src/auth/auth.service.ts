import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthAuditEventType, User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { UserRole } from "../common/enums/user-role.enum";
import { CouriersService } from "../couriers/couriers.service";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";

export interface AuthRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly couriersService: CouriersService
  ) {}

  async register(dto: RegisterDto, context?: AuthRequestContext) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestException("Email ja cadastrado");
    }

    if (dto.role === UserRole.STORE_ADMIN && (!dto.storeName || !dto.storeAddress)) {
      throw new BadRequestException(
        "STORE_ADMIN precisa informar storeName e storeAddress"
      );
    }

    if (dto.role === UserRole.COURIER && (dto.storeName || dto.storeAddress)) {
      throw new BadRequestException("COURIER nao pode criar loja no registro");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          phone: dto.phone,
          role: dto.role,
          active: true
        }
      });

      if (dto.role === UserRole.STORE_ADMIN) {
        await tx.store.create({
          data: {
            name: dto.storeName!,
            address: dto.storeAddress!,
            ownerUserId: createdUser.id,
            active: true
          }
        });
      }

      if (dto.role === UserRole.COURIER) {
        await tx.courierProfile.create({
          data: {
            userId: createdUser.id
          }
        });
      }

      return createdUser;
    });

    return this.buildAuthResponse(user, context, "register");
  }

  async registerCourier(dto: RegisterCourierDto, context?: AuthRequestContext) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const courier = await this.couriersService.createPublicCourier(dto, passwordHash);

    return this.buildAuthResponse({
      id: courier.id,
      name: courier.name,
      email: courier.email,
      phone: courier.phone,
      role: courier.role,
      active: courier.active,
      createdAt: courier.createdAt,
      updatedAt: courier.updatedAt,
      passwordHash
    } as User, context, "register_courier");
  }

  async login(dto: LoginDto, context?: AuthRequestContext) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.active) {
      await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
        email: normalizedEmail,
        context,
        metadata: { reason: "invalid_credentials_or_inactive_user" }
      });
      throw new UnauthorizedException("Credenciais invalidas");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        context,
        metadata: { reason: "invalid_credentials" }
      });
      throw new UnauthorizedException("Credenciais invalidas");
    }

    return this.buildAuthResponse(user, context, "login");
  }

  async refresh(dto: RefreshTokenDto, context?: AuthRequestContext) {
    const sessionId = this.getSessionIdFromRefreshToken(dto.refreshToken);

    if (!sessionId) {
      await this.auditAuthEvent(AuthAuditEventType.REFRESH_FAILED, {
        context,
        metadata: { reason: "malformed_refresh_token" }
      });
      throw new UnauthorizedException("Sessao invalida");
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active) {
      if (session && !session.revokedAt && !session.user.active) {
        await this.revokeSession(session.id, session.userId, context, "inactive_user");
      }

      await this.auditAuthEvent(AuthAuditEventType.REFRESH_FAILED, {
        userId: session?.userId,
        email: session?.user.email,
        sessionId,
        context,
        metadata: { reason: "inactive_or_expired_session" }
      });
      throw new UnauthorizedException("Sessao invalida");
    }

    const tokenMatches = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);

    if (!tokenMatches) {
      await this.revokeSession(session.id, session.userId, context, "refresh_token_reuse_or_mismatch");
      await this.auditAuthEvent(AuthAuditEventType.REFRESH_FAILED, {
        userId: session.userId,
        email: session.user.email,
        sessionId: session.id,
        context,
        metadata: { reason: "refresh_token_reuse_or_mismatch" }
      });
      throw new UnauthorizedException("Sessao invalida");
    }

    const refreshToken = await this.rotateRefreshToken(session.id);
    const accessToken = await this.signAccessToken(session.user);

    await this.auditAuthEvent(AuthAuditEventType.REFRESH_SUCCESS, {
      userId: session.userId,
      email: session.user.email,
      sessionId: session.id,
      context
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(session.user)
    };
  }

  async logout(dto: RefreshTokenDto, context?: AuthRequestContext) {
    const sessionId = this.getSessionIdFromRefreshToken(dto.refreshToken);

    if (!sessionId) {
      return { message: "Sessao encerrada" };
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (session && !session.revokedAt) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() }
      });
    }

    await this.auditAuthEvent(AuthAuditEventType.LOGOUT, {
      userId: session?.userId,
      email: session?.user.email,
      sessionId,
      context
    });

    return { message: "Sessao encerrada" };
  }

  private async buildAuthResponse(
    user: User,
    context?: AuthRequestContext,
    flow = "login"
  ) {
    const session = await this.createSession(user.id, context);
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    await this.auditAuthEvent(AuthAuditEventType.LOGIN_SUCCESS, {
      userId: user.id,
      email: user.email,
      sessionId: session.id,
      context,
      metadata: { flow }
    });

    return {
      accessToken,
      refreshToken: session.refreshToken,
      user: this.toAuthUser(user)
    };
  }

  private async createSession(userId: string, context?: AuthRequestContext) {
    const expiresAt = this.getRefreshTokenExpiresAt();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: "pending",
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        expiresAt
      }
    });
    const refreshToken = this.createRefreshToken(session.id);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date()
      }
    });

    return {
      id: session.id,
      refreshToken
    };
  }

  private async rotateRefreshToken(sessionId: string) {
    const refreshToken = this.createRefreshToken(sessionId);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date()
      }
    });

    return refreshToken;
  }

  private async revokeSession(
    sessionId: string,
    userId: string,
    context: AuthRequestContext | undefined,
    reason: string
  ) {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });

    await this.auditAuthEvent(AuthAuditEventType.SESSION_REVOKED, {
      userId,
      sessionId,
      context,
      metadata: { reason }
    });
  }

  private async signAccessToken(user: User) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    });
  }

  private createRefreshToken(sessionId: string) {
    return `${sessionId}.${randomBytes(48).toString("base64url")}`;
  }

  private getSessionIdFromRefreshToken(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split(".");

    if (!sessionId || !secret) {
      return null;
    }

    return sessionId;
  }

  private getRefreshTokenExpiresAt() {
    const days = Number(this.configService.get<string>("JWT_REFRESH_EXPIRES_DAYS") ?? "30");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private async auditAuthEvent(
    type: AuthAuditEventType,
    input: {
      userId?: string;
      email?: string;
      sessionId?: string;
      context?: AuthRequestContext;
      metadata?: Record<string, string>;
    }
  ) {
    await this.prisma.authAuditEvent.create({
      data: {
        type,
        userId: input.userId,
        email: input.email?.toLowerCase(),
        sessionId: input.sessionId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        metadata: input.metadata
      }
    });
  }

  private toAuthUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
