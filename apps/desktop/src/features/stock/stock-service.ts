import { http } from "../../lib/http";
import type { Product, StockMovement, StockMovementType, StockSummary } from "../../types/api";

export interface StockProductsResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StockMovementsResponse {
  items: StockMovement[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const stockService = {
  listProducts(token: string, search = "", status = "all") {
    const query = new URLSearchParams({ search, status, limit: "100" });
    return http<StockProductsResponse>(`/stock/products?${query}`, { token });
  },
  summary(token: string) {
    return http<StockSummary>("/stock/summary", { token });
  },
  movements(token: string, productId?: string) {
    const query = new URLSearchParams({ limit: "50" });
    if (productId) query.set("productId", productId);
    return http<StockMovementsResponse>(`/stock/movements?${query}`, { token });
  },
  createMovement(
    token: string,
    productId: string,
    input: {
      type: StockMovementType;
      quantity?: number;
      targetQuantity?: number;
      reason: string;
    }
  ) {
    return http<StockMovement>(`/stock/products/${productId}/movements`, {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }
};
