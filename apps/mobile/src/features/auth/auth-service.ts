import { http } from "../../lib/http";
import type { AuthResponse, AuthSession, AuthUser } from "../../types/api";

export const authService = {
  login(email: string, password: string) {
    return http<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  loginWithGoogle(idToken: string) {
    return http<AuthResponse>("/auth/login/google/mobile", {
      method: "POST",
      body: JSON.stringify({ idToken })
    });
  },
  registerClient(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    return http<AuthResponse>("/auth/register/client", {
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
  me(token: string) {
    return http<AuthUser>("/users/me", {
      token
    });
  }
};
