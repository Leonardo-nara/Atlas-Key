import { http } from "../../lib/http";
import type {
  StorefrontOpeningHour,
  StorefrontPaymentMethod,
  StorefrontSettings
} from "../../types/api";

export interface StorefrontSettingsInput {
  slug?: string | null;
  publicName?: string | null;
  publicPhone?: string | null;
  addressComplement?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipCode?: string | null;
  publicDescription?: string | null;
  storefrontEnabled?: boolean;
  pickupEnabled?: boolean;
  businessHoursNote?: string | null;
  storefrontMinimumOrder?: number;
  storefrontPaymentMethods?: StorefrontPaymentMethod[];
  storefrontOpeningHours?: StorefrontOpeningHour[];
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
