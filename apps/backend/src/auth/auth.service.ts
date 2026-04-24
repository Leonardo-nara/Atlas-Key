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
import { OAuth2Client } from "google-auth-library";

import { UserRole } from "../common/enums/user-role.enum";
import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { securityMetrics } from "../common/observability/security-metrics";
import { CouriersService } from "../couriers/couriers.service";
import { RegisterCourierDto } from "./dto/register-courier.dto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { GoogleMobileAuthDto } from "./dto/google-mobile-auth.dto";
import { RegisterClientDto } from "./dto/register-client.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterStoreQuickDto } from "./dto/register-store-quick.dto";

export interface AuthRequestContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

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

  async registerStoreQuick(
    dto: RegisterStoreQuickDto,
    context?: AuthRequestContext
  ) {
    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new BadRequestException("Email ja cadastrado");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: normalizedEmail,
          passwordHash,
          phone: "",
          role: UserRole.STORE_ADMIN,
          active: true
        }
      });

      await tx.store.create({
        data: {
          name: dto.storeName,
          address: "",
          ownerUserId: createdUser.id,
          active: true
        }
      });

      return createdUser;
    });

    return this.buildAuthResponse(user, context, "register_store_quick");
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

  async registerClient(dto: RegisterClientDto, context?: AuthRequestContext) {
    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new BadRequestException("Email ja cadastrado");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone,
        role: UserRole.CLIENT,
        active: true
      }
    });

    return this.buildAuthResponse(user, context, "register_client");
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

  async loginWithGoogleMobile(
    dto: GoogleMobileAuthDto,
    context?: AuthRequestContext
  ) {
    let googlePayload: Awaited<ReturnType<AuthService["verifyGoogleIdToken"]>>;

    try {
      googlePayload = await this.verifyGoogleIdToken(dto.idToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
          email: undefined,
          context,
          metadata: { reason: "invalid_google_id_token" }
        });
        throw error;
      }

      await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
        email: undefined,
        context,
        metadata: { reason: "google_token_verification_error" }
      });
      throw new UnauthorizedException("Nao foi possivel validar a conta Google.");
    }

    const normalizedEmail = googlePayload.email.toLowerCase();

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleSub: googlePayload.sub }, { email: normalizedEmail }]
      }
    });

    if (user && user.role !== UserRole.COURIER) {
      await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        context,
        metadata: { reason: "google_login_not_allowed_for_role" }
      });
      throw new UnauthorizedException("Use o painel da empresa para acessar esta conta.");
    }

    if (user && !user.active) {
      await this.auditAuthEvent(AuthAuditEventType.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        context,
        metadata: { reason: "inactive_google_user" }
      });
      throw new UnauthorizedException("Sua conta esta inativa no momento.");
    }

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 10);

      user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: googlePayload.name,
            email: normalizedEmail,
            passwordHash,
            phone: "",
            role: UserRole.COURIER,
            active: true,
            googleSub: googlePayload.sub,
            googleEmailVerified: true
          }
        });

        await tx.courierProfile.create({
          data: {
            userId: createdUser.id
          }
        });

        return createdUser;
      });
    } else if (
      user.googleSub !== googlePayload.sub ||
      !user.googleEmailVerified ||
      user.name !== googlePayload.name
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleSub: googlePayload.sub,
          googleEmailVerified: true,
          ...(user.name !== googlePayload.name ? { name: googlePayload.name } : {})
        }
      });
    }

    return this.buildAuthResponse(user, context, "login_google_mobile");
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
    const accessToken = await this.signAccessToken(session.user, session.id);

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

  async listActiveSessions(user: AuthenticatedUser) {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId: user.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return sessions.map((session) => ({
      ...session,
      current: session.id === user.sessionId
    }));
  }

  async logoutCurrentSession(user: AuthenticatedUser, context?: AuthRequestContext) {
    if (!user.sessionId) {
      throw new BadRequestException("Sessao atual nao identificada");
    }

    await this.revokeOwnedSession(
      user,
      user.sessionId,
      context,
      AuthAuditEventType.LOGOUT,
      "logout_current_session"
    );

    return { message: "Sessao atual encerrada" };
  }

  async logoutAllSessions(user: AuthenticatedUser, context?: AuthRequestContext) {
    const revoked = await this.revokeUserSessions(user.sub, {
      context,
      auditType: AuthAuditEventType.LOGOUT_ALL,
      reason: "logout_all_sessions",
      actorUserId: user.sub,
      actorEmail: user.email
    });

    return {
      message: "Todas as sessoes foram encerradas",
      revokedSessions: revoked
    };
  }

  async revokeOwnSession(
    user: AuthenticatedUser,
    sessionId: string,
    context?: AuthRequestContext
  ) {
    await this.revokeOwnedSession(
      user,
      sessionId,
      context,
      AuthAuditEventType.SESSION_REVOKED_BY_USER,
      "user_revoked_session"
    );

    return { message: "Sessao encerrada" };
  }

  async revokeUserSessionsForAdmin(
    userId: string,
    actor: AuthenticatedUser,
    reason: string,
    context?: AuthRequestContext
  ) {
    return this.revokeUserSessions(userId, {
      context,
      auditType: AuthAuditEventType.SESSION_REVOKED_ADMIN,
      reason,
      actorUserId: actor.sub,
      actorEmail: actor.email
    });
  }

  private async buildAuthResponse(
    user: User,
    context?: AuthRequestContext,
    flow = "login"
  ) {
    const session = await this.createSession(user.id, context);
    const accessToken = await this.signAccessToken(user, session.id);

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

  private async revokeOwnedSession(
    user: AuthenticatedUser,
    sessionId: string,
    context: AuthRequestContext | undefined,
    auditType: AuthAuditEventType,
    reason: string
  ) {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId: user.sub
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new BadRequestException("Sessao nao encontrada ou ja encerrada");
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    await this.auditAuthEvent(auditType, {
      userId: user.sub,
      email: user.email,
      sessionId: session.id,
      context,
      metadata: { reason }
    });
  }

  private async revokeUserSessions(
    userId: string,
    options: {
      context?: AuthRequestContext;
      auditType: AuthAuditEventType;
      reason: string;
      actorUserId?: string;
      actorEmail?: string;
    }
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    });

    if (sessions.length === 0) {
      return 0;
    }

    await this.prisma.authSession.updateMany({
      where: {
        id: { in: sessions.map((session) => session.id) }
      },
      data: { revokedAt: new Date() }
    });

    await Promise.all(
      sessions.map((session) =>
        this.auditAuthEvent(options.auditType, {
          userId,
          email: targetUser?.email,
          sessionId: session.id,
          context: options.context,
          metadata: {
            reason: options.reason,
            actorUserId: options.actorUserId ?? "",
            actorEmail: options.actorEmail ?? ""
          }
        })
      )
    );

    return sessions.length;
  }

  private async signAccessToken(user: User, sessionId?: string) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId
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
    this.recordAuthMetric(type, input);

    await this.prisma.authAuditEvent.create({
      data: {
        type,
        userId: input.userId,
        email: input.email?.toLowerCase(),
        sessionId: input.sessionId,
        ipAddress: input.context?.ipAddress,
        userAgent: input.context?.userAgent,
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.context?.requestId ? { requestId: input.context.requestId } : {})
        }
      }
    });
  }

  private recordAuthMetric(
    type: AuthAuditEventType,
    input: {
      email?: string;
      sessionId?: string;
      context?: AuthRequestContext;
      metadata?: Record<string, string>;
    }
  ) {
    const key =
      input.email?.toLowerCase() ??
      input.sessionId ??
      input.context?.ipAddress ??
      "unknown";

    if (type === AuthAuditEventType.LOGIN_SUCCESS) {
      securityMetrics.recordSecurityEvent("login_success", {
        key,
        requestId: input.context?.requestId
      });
      return;
    }

    if (type === AuthAuditEventType.LOGIN_FAILED) {
      securityMetrics.recordSecurityEvent("login_failed", {
        key,
        requestId: input.context?.requestId,
        reason: input.metadata?.reason
      });
      return;
    }

    if (type === AuthAuditEventType.REFRESH_SUCCESS) {
      securityMetrics.recordSecurityEvent("refresh_success", {
        key,
        requestId: input.context?.requestId
      });
      return;
    }

    if (type === AuthAuditEventType.REFRESH_FAILED) {
      securityMetrics.recordSecurityEvent("refresh_failed", {
        key,
        requestId: input.context?.requestId,
        reason: input.metadata?.reason
      });
      return;
    }

    if (type === AuthAuditEventType.LOGOUT || type === AuthAuditEventType.LOGOUT_ALL) {
      securityMetrics.recordSecurityEvent("logout", {
        key,
        requestId: input.context?.requestId,
        reason: input.metadata?.reason
      });
      return;
    }

    if (
      type === AuthAuditEventType.SESSION_REVOKED ||
      type === AuthAuditEventType.SESSION_REVOKED_BY_USER ||
      type === AuthAuditEventType.SESSION_REVOKED_ADMIN
    ) {
      securityMetrics.recordSecurityEvent("session_revoked", {
        key,
        requestId: input.context?.requestId,
        reason: input.metadata?.reason
      });
    }
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

  private async verifyGoogleIdToken(idToken: string) {
    const audiences = this.getGoogleAudiences();
    let ticket;

    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: audiences
      });
    } catch {
      throw new UnauthorizedException("Conta Google invalida para autenticacao.");
    }

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException("Conta Google invalida para autenticacao.");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name?.trim() || payload.email.split("@")[0] || "Motoboy Google"
    };
  }

  private getGoogleAudiences() {
    const configured = this.configService.get<string>("GOOGLE_AUTH_AUDIENCES") ?? "";
    const audiences = configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (audiences.length === 0) {
      throw new UnauthorizedException("Google auth nao configurado no backend.");
    }

    return audiences;
  }
}
