import { http } from "../../lib/http";
import type { StoreCourierLink } from "../../types/api";

export const storeCourierLinksService = {
  listRequests(token: string) {
    return http<StoreCourierLink[]>("/store-links/requests", {
      token
    });
  },
  listCouriers(token: string) {
    return http<StoreCourierLink[]>("/store-links/couriers", {
      token
    });
  },
  approve(token: string, linkId: string) {
    return http<StoreCourierLink>(`/store-links/${linkId}/approve`, {
      method: "PATCH",
      token
    });
  },
  reject(token: string, linkId: string) {
    return http<StoreCourierLink>(`/store-links/${linkId}/reject`, {
      method: "PATCH",
      token
    });
  }
};
