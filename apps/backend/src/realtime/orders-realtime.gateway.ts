import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoreCourierLinkStatus } from "../store-courier-links/enums/store-courier-link-status.enum";
import {
  availableOrdersStoreRoom,
  courierRoom,
  storeRoom
} from "./realtime.constants";

type SocketAuthPayload = AuthenticatedUser;

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true
  },
  transports: ["websocket"]
})
export class OrdersRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersRealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const user = await this.authenticateClient(client);
      client.data.user = user;

      if (user.role === UserRole.STORE_ADMIN) {
        const store = await this.prisma.store.findUnique({
          where: { ownerUserId: user.sub }
        });

        if (store) {
          await client.join(storeRoom(store.id));
        }
      }

      if (user.role === UserRole.COURIER) {
        await client.join(courierRoom(user.sub));

        const approvedLinks = await this.prisma.storeCourierLink.findMany({
          where: {
            courierId: user.sub,
            status: StoreCourierLinkStatus.APPROVED
          },
          select: {
            storeId: true
          }
        });

        for (const link of approvedLinks) {
          await client.join(availableOrdersStoreRoom(link.storeId));
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha na autenticacao realtime";

      this.logger.warn(`Socket rejeitado: ${message}`);
      client.emit("realtime.error", { message });
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;

    if (user) {
      this.logger.debug(`Socket desconectado para ${user.role}:${user.sub}`);
    }
  }

  private async authenticateClient(client: Socket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException("Token JWT nao informado no socket");
    }

    const payload = await this.jwtService.verifyAsync<SocketAuthPayload>(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Usuario do socket nao encontrado ou inativo");
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole
    };
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      return authorization.slice("Bearer ".length).trim();
    }

    return null;
  }
}
