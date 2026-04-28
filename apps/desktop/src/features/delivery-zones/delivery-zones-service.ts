import { http } from "../../lib/http";
import type { StoreDeliveryZone } from "../../types/api";

export interface DeliveryZoneInput {
  name: string;
  district: string;
  fee: number;
  isActive?: boolean;
}

export const deliveryZonesService = {
  list(token: string) {
    return http<StoreDeliveryZone[]>("/stores/me/delivery-zones", { token });
  },
  create(token: string, input: DeliveryZoneInput) {
    return http<StoreDeliveryZone>("/stores/me/delivery-zones", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  update(token: string, zoneId: string, input: Partial<DeliveryZoneInput>) {
    return http<StoreDeliveryZone>(`/stores/me/delivery-zones/${zoneId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  },
  deactivate(token: string, zoneId: string) {
    return http<StoreDeliveryZone>(`/stores/me/delivery-zones/${zoneId}`, {
      method: "DELETE",
      token
    });
  }
};
