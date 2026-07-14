import { http } from "../../lib/http";
import type { AdminDashboard, StoreDashboard, StoreReadiness } from "../../types/api";

export const dashboardService = {
  getStoreDashboard(token: string) {
    return http<StoreDashboard>("/stores/me/dashboard", { token });
  },

  getStoreReadiness(token: string) {
    return http<StoreReadiness>("/stores/me/readiness", { token });
  },

  getAdminDashboard(token: string) {
    return http<AdminDashboard>("/admin/dashboard", { token });
  }
};
