import { http } from "../../lib/http";
import type { AuthResponse, AuthUser } from "../../types/api";

export const authService = {
  login(email: string, password: string) {
    return http<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
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
  me(token: string) {
    return http<AuthUser>("/users/me", {
      token
    });
  }
};
