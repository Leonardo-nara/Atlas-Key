import { http } from "../../lib/http";
import type { StoreCourierLink, StoreDiscoveryItem } from "../../types/api";

export const companyLinksService = {
  listAvailableStores(token: string) {
    return http<StoreDiscoveryItem[]>("/store-links/stores", {
      token
    });
  },
  listMyLinks(token: string) {
    return http<StoreCourierLink[]>("/store-links/my", {
      token
    });
  },
  requestJoin(token: string, storeId: string) {
    return http<StoreCourierLink>("/store-links/request", {
      method: "POST",
      token,
      body: JSON.stringify({ storeId })
    });
  }
};
