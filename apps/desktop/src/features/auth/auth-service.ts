import { http } from "../../lib/http";
import type { AuthResponse, AuthSession, AuthUser, Store } from "../../types/api";

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterStoreQuickInput {
  storeName: string;
  ownerName: string;
  email: string;
  password: string;
}

export const authService = {
  login(input: LoginInput) {
    return http<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  registerStoreQuick(input: RegisterStoreQuickInput) {
    return http<AuthResponse>("/auth/register/store", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  refresh(refreshToken: string) {
    return http<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },
  logout(refreshToken: string) {
    return http<{ message: string }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },
  sessions(token: string) {
    return http<AuthSession[]>("/auth/sessions", {
      token
    });
  },
  logoutAll(token: string) {
    return http<{ message: string; revokedSessions: number }>(
      "/auth/sessions/logout-all",
      {
        method: "POST",
        token
      }
    );
  },
  revokeSession(token: string, sessionId: string) {
    return http<{ message: string }>(`/auth/sessions/${sessionId}/revoke`, {
      method: "POST",
      token
    });
  },
  me(token: string) {
    return http<AuthUser>("/users/me", {
      token
    });
  },
  myStore(token: string) {
    return http<Store>("/stores/me", {
      token
    });
  },
  uploadStoreImage(token: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return http<Store>("/stores/me/image", {
      method: "PATCH",
      token,
      body: formData
    });
  },
  removeStoreImage(token: string) {
    return http<{ message: string }>("/stores/me/image", {
      method: "DELETE",
      token
    });
  }
};
