import { http } from "../../lib/http";
import type { AuthResponse, AuthUser, Store } from "../../types/api";

interface LoginInput {
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
  me(token: string) {
    return http<AuthUser>("/users/me", {
      token
    });
  },
  myStore(token: string) {
    return http<Store>("/stores/me", {
      token
    });
  }
};
