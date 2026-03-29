import { http } from "../../lib/http";
import type { Product } from "../../types/api";

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  available: boolean;
}

export const productsService = {
  list(token: string) {
    return http<Product[]>("/products", { token });
  },
  create(token: string, input: ProductInput) {
    return http<Product>("/products", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  update(token: string, productId: string, input: ProductInput) {
    return http<Product>(`/products/${productId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  remove(token: string, productId: string) {
    return http<{ message: string }>(`/products/${productId}`, {
      method: "DELETE",
      token
    });
  }
};
