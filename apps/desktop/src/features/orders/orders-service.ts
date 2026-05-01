import { http } from "../../lib/http";
import { env } from "../../lib/env";
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
  paymentMethod?: Order["paymentMethod"];
  notes?: string;
  items: CreateOrderItemInput[];
}

export interface CancelOrderInput {
  reason?: string;
}

export interface ConfirmOrderInput {
  deliveryFee?: number;
}

export interface ReviewPaymentProofInput {
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
  },
  confirm(token: string, orderId: string, input: ConfirmOrderInput) {
    return http<Order>(`/orders/${orderId}/confirm`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  markPaymentPaid(token: string, orderId: string) {
    return http<Order>(`/orders/${orderId}/payment/paid`, {
      method: "PATCH",
      token
    });
  },
  approvePaymentProof(token: string, orderId: string, input: ReviewPaymentProofInput) {
    return http<Order>(`/orders/${orderId}/payment-proof/approve`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  rejectPaymentProof(token: string, orderId: string, input: ReviewPaymentProofInput) {
    return http<Order>(`/orders/${orderId}/payment-proof/reject`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  async downloadPaymentProofFile(token: string, order: Order) {
    if (!order.paymentProofFileUrl) {
      throw new Error("Este pedido nao possui arquivo de comprovante.");
    }

    const response = await fetch(`${env.apiUrl}${order.paymentProofFileUrl}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let message =
        "Não foi possível abrir o comprovante. Tente novamente ou solicite um novo envio ao cliente.";

      try {
        const payload = (await response.json()) as { message?: string | string[]; error?: string };
        message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message ?? payload.error ?? message;
      } catch {
        // Mantem mensagem padrao quando a resposta nao for JSON.
      }

      throw new Error(message);
    }

    return {
      blob: await response.blob(),
      fileName: order.paymentProofFileName ?? "comprovante-pix"
    };
  }
};
