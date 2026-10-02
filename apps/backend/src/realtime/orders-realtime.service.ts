import { Injectable } from "@nestjs/common";
import type {
  RealtimeOrderEventName,
  RealtimeOrderEventPayload,
  RealtimeOrderSnapshot
} from "@deliveries/shared-types";

import { NotificationsService } from "../notifications/notifications.service";
import { OrdersRealtimeGateway } from "./orders-realtime.gateway";
import {
  ORDER_SOCKET_EVENTS,
  availableOrdersStoreRoom,
  clientRoom,
  courierRoom,
  storeRoom
} from "./realtime.constants";

interface BroadcastableOrder {
  id: string;
  storeId: string;
  courierId?: string | null;
  clientId?: string | null;
  status: string;
  statusLabel?: string;
  customerName: string;
  total: number;
  updatedAt: string | Date;
}

@Injectable()
export class OrdersRealtimeService {
  constructor(
    private readonly gateway: OrdersRealtimeGateway,
    private readonly notificationsService: NotificationsService
  ) {}

  emitOrderCreated(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.CREATED, order, [
      storeRoom(order.storeId),
      availableOrdersStoreRoom(order.storeId),
      order.clientId ? clientRoom(order.clientId) : null
    ]);
  }

  emitOrderAccepted(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.ACCEPTED, order, [
      storeRoom(order.storeId),
      availableOrdersStoreRoom(order.storeId),
      order.clientId ? clientRoom(order.clientId) : null,
      order.courierId ? courierRoom(order.courierId) : null
    ]);
  }

  emitOrderStatusUpdated(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.STATUS_UPDATED, order, [
      storeRoom(order.storeId),
      availableOrdersStoreRoom(order.storeId),
      order.clientId ? clientRoom(order.clientId) : null,
      order.courierId ? courierRoom(order.courierId) : null
    ]);
  }

  emitOrderCancelled(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.CANCELLED, order, [
      storeRoom(order.storeId),
      availableOrdersStoreRoom(order.storeId),
      order.clientId ? clientRoom(order.clientId) : null,
      order.courierId ? courierRoom(order.courierId) : null
    ]);
  }

  private emitToRooms(
    event: RealtimeOrderEventName,
    order: BroadcastableOrder,
    rooms: Array<string | null>
  ) {
    const payload: RealtimeOrderEventPayload = {
      event,
      order: this.toSnapshot(order),
      occurredAt: new Date().toISOString()
    };

    void this.gateway.emitAuthorized(event, payload, rooms.filter((value): value is string => Boolean(value)));
    this.notificationsService.notifyOrderEvent(event, order);
  }

  private toSnapshot(order: BroadcastableOrder): RealtimeOrderSnapshot {
    return {
      id: order.id,
      storeId: order.storeId,
      courierId: order.courierId ?? null,
      status: order.status,
      statusLabel: order.statusLabel,
      customerName: order.customerName,
      total: order.total,
      updatedAt:
        order.updatedAt instanceof Date
          ? order.updatedAt.toISOString()
          : order.updatedAt
    };
  }
}
