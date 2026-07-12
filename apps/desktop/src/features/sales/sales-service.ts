import { http } from "../../lib/http";
import type { PaginatedResponse, Sale, SalePaymentMethod, SaleReceipt } from "../../types/api";

export interface CreateSaleInput {
  customerName?: string;
  customerDocument?: string;
  notes?: string;
}

export interface AddSaleItemInput {
  productId: string;
  quantity: number;
}

export interface UpdateSaleInput {
  customerName?: string;
  customerDocument?: string;
  notes?: string;
  discountAmount?: number;
  surchargeAmount?: number;
}

export interface CompleteSalePaymentInput {
  method: SalePaymentMethod;
  amount: number;
}

export const salesService = {
  list(token: string, options?: { page?: number; status?: Sale["status"]; search?: string }) {
    const query = new URLSearchParams();

    if (options?.page) {
      query.set("page", String(options.page));
    }

    if (options?.status) {
      query.set("status", options.status);
    }

    if (options?.search?.trim()) {
      query.set("search", options.search.trim());
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    return http<PaginatedResponse<Sale>>(`/sales${suffix}`, { token });
  },
  create(token: string, input: CreateSaleInput = {}) {
    return http<Sale>("/sales", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  get(token: string, saleId: string) {
    return http<Sale>(`/sales/${saleId}`, { token });
  },
  addItem(token: string, saleId: string, input: AddSaleItemInput) {
    return http<Sale>(`/sales/${saleId}/items`, {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  updateItem(
    token: string,
    saleId: string,
    itemId: string,
    input: { quantity?: number; discountAmount?: number; surchargeAmount?: number }
  ) {
    return http<Sale>(`/sales/${saleId}/items/${itemId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  removeItem(token: string, saleId: string, itemId: string) {
    return http<Sale>(`/sales/${saleId}/items/${itemId}`, {
      method: "DELETE",
      token
    });
  },
  update(token: string, saleId: string, input: UpdateSaleInput) {
    return http<Sale>(`/sales/${saleId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  complete(
    token: string,
    saleId: string,
    payments: CompleteSalePaymentInput[],
    cashRegisterSessionId?: string
  ) {
    return http<Sale>(`/sales/${saleId}/complete`, {
      method: "POST",
      token,
      body: JSON.stringify({ payments, cashRegisterSessionId })
    });
  },
  cancel(token: string, saleId: string, reason?: string) {
    return http<Sale>(`/sales/${saleId}/cancel`, {
      method: "POST",
      token,
      body: JSON.stringify({ reason })
    });
  },
  receipt(token: string, saleId: string) {
    return http<SaleReceipt>(`/sales/${saleId}/receipt`, { token });
  }
};
