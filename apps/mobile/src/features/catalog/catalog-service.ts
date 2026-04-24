import { http } from "../../lib/http";
import type { ClientCatalogStore, StoreCatalogResponse } from "../../types/api";

export const catalogService = {
  listStores(search?: string) {
    const query = search?.trim()
      ? `/catalog/stores?search=${encodeURIComponent(search.trim())}`
      : "/catalog/stores";

    return http<ClientCatalogStore[]>(query);
  },
  getStoreProducts(storeId: string, search?: string) {
    const suffix = search?.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : "";

    return http<StoreCatalogResponse>(`/catalog/stores/${storeId}/products${suffix}`);
  }
};
