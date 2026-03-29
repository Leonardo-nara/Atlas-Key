import { http } from "../../lib/http";
import type { AuthResponse, AuthUser } from "../../types/api";

export const authService = {
  login(email: string, password: string) {
    return http<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  me(token: string) {
    return http<AuthUser>("/users/me", {
      token
    });
  }
};
