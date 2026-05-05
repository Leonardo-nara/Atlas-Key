import { http } from "../../lib/http";
import type {
  AdminCourier,
  AdminStore,
  AdminUser,
  OperationalStatus
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

export const adminService = {
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
