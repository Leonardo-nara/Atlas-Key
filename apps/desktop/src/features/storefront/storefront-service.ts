import { http } from "../../lib/http";
import type { StorefrontSettings } from "../../types/api";

export interface StorefrontSettingsInput {
  slug?: string | null;
  publicDescription?: string | null;
  storefrontEnabled?: boolean;
  pickupEnabled?: boolean;
  businessHoursNote?: string | null;
  averagePreparationMinutes?: number;
  deliveryTimeMinMinutes?: number;
  deliveryTimeMaxMinutes?: number;
}

export const storefrontService = {
  getSettings(token: string) {
    return http<StorefrontSettings>("/stores/me/storefront", { token });
  },
  updateSettings(token: string, input: StorefrontSettingsInput) {
    return http<StorefrontSettings>("/stores/me/storefront", {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  }
};
