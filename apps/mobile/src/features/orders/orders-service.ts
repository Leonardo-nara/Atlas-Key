import { mobileEnv } from "../../env";
import { ApiError, http } from "../../lib/http";
import type { Order, OrderPaymentMethod, PaginatedResponse } from "../../types/api";

export interface PaymentProofAttachment {
  uri: string;
  name: string;
  type: string;
}

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
  submitPaymentProof(
    token: string,
    orderId: string,
    input: {
      payerName?: string;
      amount?: number;
      reference?: string;
      notes?: string;
    }
  ) {
    return http<Order>(`/orders/${orderId}/payment-proof`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  async uploadPaymentProofFile(
    token: string,
    orderId: string,
    input: {
      payerName?: string;
      amount?: string;
      reference?: string;
      notes?: string;
      file: PaymentProofAttachment;
    }
  ) {
    const formData = new FormData();

    formData.append("file", {
      uri: input.file.uri,
      name: input.file.name,
      type: input.file.type
    } as unknown as Blob);

    if (input.payerName) {
      formData.append("payerName", input.payerName);
    }

    if (input.amount) {
      formData.append("amount", input.amount);
    }

    if (input.reference) {
      formData.append("reference", input.reference);
    }

    if (input.notes) {
      formData.append("notes", input.notes);
    }

    let response: Response;

    try {
      response = await fetch(`${mobileEnv.apiUrl}/orders/${orderId}/payment-proof/file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
    } catch {
      throw new ApiError(
        "Nao foi possivel conectar ao backend. Confira o IP ou dominio configurado no app.",
        0
      );
    }

    if (!response.ok) {
      let message = "Nao foi possivel enviar o comprovante.";

      try {
        const payload = (await response.json()) as {
          message?: string | string[];
          error?: string;
        };
        message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message ?? payload.error ?? message;
      } catch {
        // Mantem mensagem padrao quando a resposta nao for JSON.
      }

      throw new ApiError(message, response.status);
    }

    return (await response.json()) as Order;
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
