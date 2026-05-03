import { http } from "../../lib/http";
import type { Product } from "../../types/api";

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  imageFile?: File | null;
  removeImage?: boolean;
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
      body: JSON.stringify(toProductRequestBody(input))
    });
  },
  update(token: string, productId: string, input: ProductInput) {
    return http<Product>(`/products/${productId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(toProductRequestBody(input))
    });
  },
  remove(token: string, productId: string) {
    return http<{ message: string }>(`/products/${productId}`, {
      method: "DELETE",
      token
    });
  },
  uploadImage(token: string, productId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return http<Product>(`/products/${productId}/image`, {
      method: "PATCH",
      token,
      body: formData
    });
  },
  removeImage(token: string, productId: string) {
    return http<Product>(`/products/${productId}/image`, {
      method: "DELETE",
      token
    });
  }
};

function toProductRequestBody(input: ProductInput) {
  return {
    name: input.name,
    description: input.description,
    price: input.price,
    category: input.category,
    imageUrl: input.imageUrl,
    available: input.available
  };
}
