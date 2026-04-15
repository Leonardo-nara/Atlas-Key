import type { ApiErrorPayload } from "../types/api";
import { env } from "./env";
import {
  clearStoredTokens,
  getStoredRefreshToken,
  setStoredTokens
} from "./storage";

export const AUTH_EXPIRED_EVENT = "desktop-auth-expired";
export const AUTH_REFRESHED_EVENT = "desktop-auth-refreshed";

interface AuthRefreshPayload {
  accessToken: string;
  refreshToken: string;
}

let refreshPromise: Promise<AuthRefreshPayload | null> | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function http<T>(
  path: string,
  { token, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  };
  let response = await sendRequest(path, init, requestHeaders);

  if (response.status === 401 && token && !isAuthRecoveryPath(path)) {
    const refreshedTokens = await refreshAccessToken();

    if (refreshedTokens) {
      response = await sendRequest(path, init, {
        ...requestHeaders,
        Authorization: `Bearer ${refreshedTokens.accessToken}`
      });
    } else {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
  }

  if (!response.ok) {
    const payload = (await tryParseJson<ApiErrorPayload>(response)) ?? {};
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? "Erro inesperado na API";

    if (response.status === 401 && token && !isAuthRecoveryPath(path)) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function sendRequest(
  path: string,
  init: RequestInit,
  headers: HeadersInit
) {
  try {
    return await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers
    });
  } catch {
    throw new ApiError(
      "Nao foi possivel conectar ao backend. Verifique a URL da API e sua conexao.",
      0
    );
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function performRefresh(): Promise<AuthRefreshPayload | null> {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    clearStoredTokens();
    return null;
  }

  const tokens = (await response.json()) as AuthRefreshPayload;
  setStoredTokens(tokens.accessToken, tokens.refreshToken);
  window.dispatchEvent(
    new CustomEvent<AuthRefreshPayload>(AUTH_REFRESHED_EVENT, { detail: tokens })
  );

  return tokens;
}

async function tryParseJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function isAuthRecoveryPath(path: string) {
  return path === "/auth/login" || path === "/auth/refresh" || path === "/auth/logout";
}
