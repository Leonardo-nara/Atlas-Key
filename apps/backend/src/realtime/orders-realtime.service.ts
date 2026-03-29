import { Injectable } from "@nestjs/common";
import type {
  RealtimeOrderEventName,
  RealtimeOrderEventPayload,
  RealtimeOrderSnapshot
} from "@deliveries/shared-types";
import type { Server } from "socket.io";

import { OrdersRealtimeGateway } from "./orders-realtime.gateway";
import {
  ORDER_SOCKET_EVENTS,
  availableOrdersRoom,
  courierRoom,
  storeRoom
} from "./realtime.constants";

interface BroadcastableOrder {
  id: string;
  storeId: string;
  courierId?: string | null;
  status: string;
  statusLabel?: string;
  customerName: string;
  total: number;
  updatedAt: string | Date;
}

@Injectable()
export class OrdersRealtimeService {
  constructor(private readonly gateway: OrdersRealtimeGateway) {}

  emitOrderCreated(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.CREATED, order, [
      storeRoom(order.storeId),
      availableOrdersRoom()
    ]);
  }

  emitOrderAccepted(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.ACCEPTED, order, [
      storeRoom(order.storeId),
      availableOrdersRoom(),
      order.courierId ? courierRoom(order.courierId) : null
    ]);
  }

  emitOrderStatusUpdated(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.STATUS_UPDATED, order, [
      storeRoom(order.storeId),
      order.courierId ? courierRoom(order.courierId) : null
    ]);
  }

  emitOrderCancelled(order: BroadcastableOrder) {
    this.emitToRooms(ORDER_SOCKET_EVENTS.CANCELLED, order, [
      storeRoom(order.storeId),
      availableOrdersRoom(),
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

    let emitter: Server | ReturnType<Server["to"]> = this.gateway.server;

    for (const room of rooms.filter((value): value is string => Boolean(value))) {
      emitter = emitter.to(room);
    }

    emitter.emit(event, payload);
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
