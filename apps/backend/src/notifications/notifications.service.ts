import { Injectable, Logger } from "@nestjs/common";

import { structuredLog } from "../common/observability/structured-log";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceTokenDto } from "./dto/register-device-token.dto";

interface PushNotificationInput {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface OrderNotificationSnapshot {
  id: string;
  storeId: string;
  clientId?: string | null;
  courierId?: string | null;
  status: string;
  fulfillmentType?: string;
  statusLabel?: string;
  customerName: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  listDevices(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: {
        userId,
        disabledAt: null
      },
      select: {
        id: true,
        platform: true,
        appProfile: true,
        lastUsedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceTokenDto) {
    const token = dto.token.trim();

    const device = await this.prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId,
        platform: dto.platform,
        appProfile: dto.appProfile?.trim() || "mobile",
        disabledAt: null,
        lastUsedAt: new Date()
      },
      create: {
        userId,
        token,
        platform: dto.platform,
        appProfile: dto.appProfile?.trim() || "mobile",
        lastUsedAt: new Date()
      },
      select: {
        id: true,
        platform: true,
        appProfile: true,
        lastUsedAt: true,
        createdAt: true
      }
    });

    return device;
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.prisma.deviceToken.updateMany({
      where: {
        id: deviceId,
        userId
      },
      data: {
        disabledAt: new Date()
      }
    });

    return { message: "Dispositivo removido das notificacoes." };
  }

  async removeAllDevices(userId: string) {
    await this.prisma.deviceToken.updateMany({
      where: {
        userId,
        disabledAt: null
      },
      data: {
        disabledAt: new Date()
      }
    });

    return { message: "Dispositivos removidos das notificacoes." };
  }

  notifyOrderEvent(event: string, order: OrderNotificationSnapshot) {
    if (event === "orders.available") {
      void this.notifyAvailableCouriers(order);
    }

    if (event.includes("created")) {
      void this.notifyStore(order.storeId, {
        title: "Novo pedido recebido",
        body: `${order.customerName} enviou um pedido para a loja.`,
        data: { type: "order.created", orderId: order.id }
      });
    }

    if (order.clientId && !event.includes("created")) {
      void this.notifyUsers([order.clientId], {
        title: "Pedido atualizado",
        body: order.statusLabel ?? "O status do seu pedido foi atualizado.",
        data: { type: "order.updated", orderId: order.id, status: order.status }
      });
    }

    if (order.courierId && event.includes("status")) {
      void this.notifyUsers([order.courierId], {
        title: "Entrega atualizada",
        body: order.statusLabel ?? "Uma entrega foi atualizada.",
        data: { type: "order.courier.updated", orderId: order.id }
      });
    }
  }

  private async notifyAvailableCouriers(order: OrderNotificationSnapshot) {
    if (
      process.env.PUSH_NOTIFICATIONS_ENABLED !== "true" ||
      order.status !== "PENDING" ||
      order.fulfillmentType === "PICKUP" ||
      order.courierId
    ) {
      return;
    }

    try {
      const links = await this.prisma.storeCourierLink.findMany({
        where: {
          storeId: order.storeId,
          status: "APPROVED",
          store: { active: true, status: "ACTIVE" },
          courier: { role: "COURIER", active: true, status: "ACTIVE" }
        },
        select: { courierId: true }
      });

      await this.notifyUsers([...new Set(links.map((link) => link.courierId))], {
        title: "Nova entrega dispon\u00edvel",
        body: "Nova entrega dispon\u00edvel no Mototake. Abra o app para conferir e aceitar.",
        data: { type: "order.available", orderId: order.id }
      });
    } catch {
      structuredLog(this.logger, "warn", {
        event: "courier_available_push_failed"
      });
    }
  }

  private async notifyStore(storeId: string, notification: PushNotificationInput) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { ownerUserId: true }
    });

    if (!store) {
      return;
    }

    await this.notifyUsers([store.ownerUserId], notification);
  }

  private async notifyUsers(userIds: string[], notification: PushNotificationInput) {
    if (process.env.PUSH_NOTIFICATIONS_ENABLED !== "true") {
      return;
    }

    const devices = await this.prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
        disabledAt: null
      },
      select: {
        id: true,
        token: true
      }
    });

    const expoDevices = devices.filter((device) => isExpoPushToken(device.token));

    if (expoDevices.length === 0) {
      return;
    }

    const messages = expoDevices.map((device) => ({
      to: device.token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {}
    }));

    // Expo accepts at most 100 notifications per request.
    for (let start = 0; start < messages.length; start += 100) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(messages.slice(start, start + 100)),
          signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
          structuredLog(this.logger, "warn", {
            event: "push_notification_failed",
            statusCode: response.status
          });
        }
      } catch {
        structuredLog(this.logger, "warn", {
          event: "push_notification_failed"
        });
      }
    }
  }
}

function isExpoPushToken(token: string) {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}
