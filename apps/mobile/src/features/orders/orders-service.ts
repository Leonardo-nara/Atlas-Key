import { http } from "../../lib/http";
import type { Order, PaginatedResponse } from "../../types/api";

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
