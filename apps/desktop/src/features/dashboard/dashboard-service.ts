import { http } from "../../lib/http";
import type { AdminDashboard, StoreDashboard } from "../../types/api";

export const dashboardService = {
  getStoreDashboard(token: string) {
    return http<StoreDashboard>("/stores/me/dashboard", { token });
  },

  getAdminDashboard(token: string) {
    return http<AdminDashboard>("/admin/dashboard", { token });
  }
};
