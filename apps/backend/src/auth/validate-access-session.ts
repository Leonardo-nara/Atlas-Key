import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { UserRole } from "../common/enums/user-role.enum";

export interface SessionAccessPayload {
  sub: string;
  sid?: string;
  exp?: number;
}

export async function validateAccessSession(prisma: PrismaService, payload: SessionAccessPayload): Promise<AuthenticatedUser> {
  if (!payload.sub || typeof payload.sid !== "string" || !payload.sid.trim()) {
    throw new UnauthorizedException("Sessao invalida");
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, active: true, status: true }
  });
  if (!user || !user.active || user.status !== "ACTIVE") {
    throw new UnauthorizedException("Sessao invalida");
  }
  const session = await prisma.authSession.findFirst({
    where: { id: payload.sid, userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true }
  });
  if (!session) throw new UnauthorizedException("Sessao revogada");
  return { sub: user.id, email: user.email, role: user.role as UserRole, sessionId: payload.sid };
}
