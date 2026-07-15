import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server, Socket } from "socket.io";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoreCourierLinkStatus } from "../store-courier-links/enums/store-courier-link-status.enum";
import { isCorsOriginAllowed } from "../common/security/cors";
import { structuredLog } from "../common/observability/structured-log";
import {
  availableOrdersStoreRoom,
  clientRoom,
  courierRoom,
  storeRoom
} from "./realtime.constants";

type SocketAuthPayload = AuthenticatedUser;

@WebSocketGateway({
  cors: {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem de socket nao permitida"), false);
    },
    credentials: false
  },
  transports: ["websocket"]
})
export class OrdersRealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersRealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  afterInit(server: Server) {
    void this.configureRedisAdapter(server);
  }

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

      if (user.role === UserRole.CLIENT) {
        await client.join(clientRoom(user.sub));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha na autenticacao realtime";

      structuredLog(this.logger, "warn", {
        event: "realtime_connection_rejected",
        socketId: client.id,
        reason: message
      });
      client.emit("realtime.error", { message });
      client.disconnect();
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = client.data.user as AuthenticatedUser | undefined;

    if (user) {
      structuredLog(this.logger, "debug", {
        event: "realtime_disconnect",
        socketId: client.id,
        userId: user.sub,
        role: user.role
      });
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

  private async configureRedisAdapter(server: Server) {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      structuredLog(this.logger, "log", {
        event: "realtime_redis_adapter_skipped",
        reason: "REDIS_URL ausente; usando realtime em memoria"
      });
      return;
    }

    try {
      const publisher = createClient({ url: redisUrl });
      const subscriber = publisher.duplicate();

      publisher.on("error", (error) => {
        structuredLog(this.logger, "warn", {
          event: "realtime_redis_publisher_error",
          message: error.message
        });
      });

      subscriber.on("error", (error) => {
        structuredLog(this.logger, "warn", {
          event: "realtime_redis_subscriber_error",
          message: error.message
        });
      });

      await Promise.all([publisher.connect(), subscriber.connect()]);
      server.adapter(createAdapter(publisher, subscriber));

      structuredLog(this.logger, "log", {
        event: "realtime_redis_adapter_enabled"
      });
    } catch (error) {
      structuredLog(this.logger, "warn", {
        event: "realtime_redis_adapter_failed",
        message:
          error instanceof Error
            ? error.message
            : "Falha desconhecida ao configurar Redis"
      });
    }
  }
}
