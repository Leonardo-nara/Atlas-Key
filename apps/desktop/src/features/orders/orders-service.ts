import { http } from "../../lib/http";
import type { Order, OrderAuditEvent, PaginatedResponse } from "../../types/api";

export interface CreateOrderItemInput {
  productId?: string;
  nameSnapshot?: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryFee: number;
  notes?: string;
  items: CreateOrderItemInput[];
}

export interface CancelOrderInput {
  reason?: string;
}

export const ordersService = {
  list(
    token: string,
    options?: {
      page?: number;
      limit?: number;
      status?: "pending" | "accepted" | "picked_up" | "delivered" | "cancelled";
    }
  ) {
    const query = new URLSearchParams();

    if (options?.page) {
      query.set("page", String(options.page));
    }

    if (options?.limit) {
      query.set("limit", String(options.limit));
    }

    if (options?.status) {
      query.set("status", options.status);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    return http<PaginatedResponse<Order>>(`/orders${suffix}`, {
      token
    });
  },
  create(token: string, input: CreateOrderInput) {
    return http<Order>("/orders", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  history(token: string, orderId: string) {
    return http<OrderAuditEvent[]>(`/orders/${orderId}/history`, {
      token
    });
  },
  cancel(token: string, orderId: string, input: CancelOrderInput) {
    return http<Order>(`/orders/${orderId}/cancel`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  }
};
