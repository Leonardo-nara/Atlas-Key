import { http } from "../../lib/http";
import type { Order, OrderPaymentMethod, PaginatedResponse } from "../../types/api";

export const ordersService = {
  available(token: string, page = 1, limit = 10) {
    return http<PaginatedResponse<Order>>(
      `/orders/available?page=${page}&limit=${limit}`,
      { token }
    );
  },
  mine(token: string, scope: "active" | "completed" | "all", page = 1, limit = 10) {
    return http<PaginatedResponse<Order>>(
      `/orders/my?scope=${scope}&page=${page}&limit=${limit}`,
      { token }
    );
  },
  clientMine(token: string, page = 1, limit = 10) {
    return http<PaginatedResponse<Order>>(
      `/orders/client/my?page=${page}&limit=${limit}`,
      { token }
    );
  },
  createClient(
    token: string,
    input: {
      storeId: string;
      fulfillmentType: "DELIVERY" | "PICKUP";
      customerAddress?: string;
      addressStreet?: string;
      addressNumber?: string;
      addressDistrict?: string;
      addressComplement?: string;
      addressCity?: string;
      addressReference?: string;
      paymentMethod: Exclude<OrderPaymentMethod, "ONLINE">;
      notes?: string;
      items: Array<{ productId: string; quantity: number }>;
    }
  ) {
    return http<Order>("/orders/client", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  accept(token: string, orderId: string) {
    return http<Order>(`/orders/${orderId}/accept`, {
      method: "PATCH",
      token
    });
  },
  updateStatus(
    token: string,
    orderId: string,
    status: "accepted" | "picked_up" | "delivered"
  ) {
    return http<Order>(`/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status })
    });
  }
};
