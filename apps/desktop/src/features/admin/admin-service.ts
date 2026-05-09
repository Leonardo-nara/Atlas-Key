import { http } from "../../lib/http";
import type {
  AdminAuditLog,
  AdminCourier,
  AdminStore,
  AdminUser,
  OperationalStatus,
  PaginatedResponse
} from "../../types/api";

interface CreateAdminStoreInput {
  storeName: string;
  storeAddress: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone?: string;
}

interface CreateAdminUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: AdminUser["role"];
}

interface ListAuditLogsInput {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
}

export const adminService = {
  listAuditLogs(token: string, input: ListAuditLogsInput = {}) {
    const params = new URLSearchParams();

    if (input.page) {
      params.set("page", String(input.page));
    }

    if (input.limit) {
      params.set("limit", String(input.limit));
    }

    if (input.action?.trim()) {
      params.set("action", input.action.trim());
    }

    if (input.targetType?.trim()) {
      params.set("targetType", input.targetType.trim());
    }

    const query = params.toString();

    return http<PaginatedResponse<AdminAuditLog>>(
      `/admin/audit-logs${query ? `?${query}` : ""}`,
      { token }
    );
  },
  listStores(token: string) {
    return http<AdminStore[]>("/admin/stores", { token });
  },
  createStore(token: string, input: CreateAdminStoreInput) {
    return http<AdminStore>("/admin/stores", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  updateStoreStatus(token: string, storeId: string, status: OperationalStatus) {
    return http<AdminStore>(`/admin/stores/${storeId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status })
    });
  },
  listUsers(token: string) {
    return http<AdminUser[]>("/admin/users", { token });
  },
  createUser(token: string, input: CreateAdminUserInput) {
    return http<AdminUser>("/admin/users", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  },
  updateUserStatus(token: string, userId: string, status: OperationalStatus) {
    return http<AdminUser>(`/admin/users/${userId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status })
    });
  },
  listCouriers(token: string) {
    return http<AdminCourier[]>("/admin/couriers", { token });
  },
  updateCourierStatus(token: string, courierId: string, status: OperationalStatus) {
    return http<AdminUser>(`/admin/couriers/${courierId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status })
    });
  },
  blockCourierLink(token: string, courierId: string, linkId: string) {
    return http<{ id: string; status: string }>(
      `/admin/couriers/${courierId}/links/${linkId}`,
      {
        method: "DELETE",
        token
      }
    );
  }
};
