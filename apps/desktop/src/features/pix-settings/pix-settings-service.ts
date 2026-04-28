import { http } from "../../lib/http";
import type { StorePixKeyType, StorePixSettings } from "../../types/api";

export interface PixSettingsInput {
  pixEnabled: boolean;
  pixKeyType?: StorePixKeyType | null;
  pixKey?: string | null;
  pixRecipientName?: string | null;
  pixInstructions?: string | null;
}

export const pixSettingsService = {
  get(token: string) {
    return http<StorePixSettings>("/stores/me/pix-settings", { token });
  },
  update(token: string, input: PixSettingsInput) {
    return http<StorePixSettings>("/stores/me/pix-settings", {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  }
};
