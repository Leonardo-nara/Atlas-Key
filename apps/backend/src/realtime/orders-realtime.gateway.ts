import { Logger, UnauthorizedException, OnModuleDestroy } from "@nestjs/common";
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
import { validateAccessSession, SessionAccessPayload } from "../auth/validate-access-session";

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

type SocketAuthPayload = SessionAccessPayload;
type AuthorizationBatch = Map<string, Promise<{ user: AuthenticatedUser; rooms: string[] }>>;

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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersRealtimeGateway.name);
  private authorizationTimer?: ReturnType<typeof setInterval>;
  private checkingConnections = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  afterInit(server: Server) {
    void this.configureRedisAdapter(server);
    this.authorizationTimer = setInterval(() => {
      if (this.checkingConnections) return;
      this.checkingConnections = true;
      void this.revalidateConnections().finally(() => { this.checkingConnections = false; });
    }, 30_000);
    this.authorizationTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.authorizationTimer);
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const user = await this.authenticateClient(client);
      client.data.user = user;

      for (const room of await this.authorizedRooms(user)) await client.join(room);
    } catch {
      const message = "Sessao realtime invalida";

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
    if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new UnauthorizedException("Sessao invalida");
    const user = await validateAccessSession(this.prisma, payload);
    // Retain only validated claims, never the bearer credential in adapter data.
    client.data.accessSession = { sub: payload.sub, sid: payload.sid, exp: payload.exp };
    return user;
  }

  private async authorizedRooms(user: AuthenticatedUser): Promise<string[]> {
    if (user.role === UserRole.CLIENT) return [clientRoom(user.sub)];
    if (user.role === UserRole.STORE_ADMIN) {
      const store = await this.prisma.store.findUnique({ where: { ownerUserId: user.sub } });
      if (!store || !store.active || store.status !== "ACTIVE") throw new UnauthorizedException("Loja inativa");
      return [storeRoom(store.id)];
    }
    if (user.role === UserRole.COURIER) {
      const links = await this.prisma.storeCourierLink.findMany({
        where: { courierId: user.sub, status: StoreCourierLinkStatus.APPROVED, store: { active: true, status: "ACTIVE" } },
        select: { storeId: true }
      });
      return [courierRoom(user.sub), ...links.map(link => availableOrdersStoreRoom(link.storeId))];
    }
    return [];
  }

  private async revalidateConnections() {
    try {
      const sockets = await this.server.local.fetchSockets();
      const checks: AuthorizationBatch = new Map();
      await Promise.all(sockets.map(socket => this.refreshAuthorization(socket, checks)));
    } catch {
      this.logger.warn("Falha na revalidacao realtime");
    }
  }

  private async refreshAuthorization(
    socket: Awaited<ReturnType<Server["fetchSockets"]>>[number],
    checks: AuthorizationBatch
  ): Promise<string[]> {
    try {
      const payload = socket.data.accessSession as SocketAuthPayload | undefined;
      if (!payload?.exp || payload.exp * 1000 <= Date.now()) throw new UnauthorizedException();
      const key = `${payload.sub}:${payload.sid}`;
      let check = checks.get(key);
      if (!check) {
        check = validateAccessSession(this.prisma, payload).then(async user => ({
          user, rooms: await this.authorizedRooms(user)
        }));
        checks.set(key, check);
      }
      const { user, rooms } = await check;
      if (socket.data.user?.role !== user.role) throw new UnauthorizedException();
      for (const room of socket.rooms) {
        if (room !== socket.id && !rooms.includes(room)) await socket.leave(room);
      }
      for (const room of rooms) await socket.join(room);
      return rooms;
    } catch {
      socket.disconnect(true);
      return [];
    }
  }

  async emitAuthorized(event: string, payload: unknown, rooms: string[]) {
    try {
      // fetchSockets includes remote replicas when Redis is configured. Check before delivery,
      // not only on the periodic sweep, so revoked sockets cannot receive the next event.
      const sockets = await this.server.in(rooms).fetchSockets();
      const checks: AuthorizationBatch = new Map();
      await Promise.all(sockets.map(async socket => {
        const allowedRooms = await this.refreshAuthorization(socket, checks);
        if (rooms.some(room => allowedRooms.includes(room))) socket.emit(event, payload);
      }));
    } catch {
      this.logger.warn("Falha no envio realtime autorizado");
    }
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
