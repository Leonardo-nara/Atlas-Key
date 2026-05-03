import { mobileEnv } from "../env";
import type { ApiErrorPayload } from "../types/api";
import {
  clearStoredTokens,
  getStoredRefreshToken,
  setStoredTokens
} from "./storage";

interface AuthRefreshPayload {
  accessToken: string;
  refreshToken: string;
}

interface AuthSessionListeners {
  onExpired?: () => void | Promise<void>;
  onRefresh?: (tokens: AuthRefreshPayload) => void | Promise<void>;
}

let refreshPromise: Promise<AuthRefreshPayload | null> | null = null;
let authSessionListeners: AuthSessionListeners = {};

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

export function setAuthSessionListeners(listeners: AuthSessionListeners) {
  authSessionListeners = listeners;
}

export async function http<T>(
  path: string,
  { token, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const requestHeaders = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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
      await authSessionListeners.onExpired?.();
    }
  }

  if (!response.ok) {
    const payload = (await tryParseJson<ApiErrorPayload>(response)) ?? {};
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? "Erro inesperado na API";

    if (response.status === 401 && token && !isAuthRecoveryPath(path)) {
      await authSessionListeners.onExpired?.();
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
    return await fetch(`${mobileEnv.apiUrl}${path}`, {
      ...init,
      headers
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao backend. Confira o IP ou domínio configurado no app.",
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
  const refreshToken = await getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${mobileEnv.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    await clearStoredTokens();
    return null;
  }

  const tokens = (await response.json()) as AuthRefreshPayload;
  await setStoredTokens(tokens.accessToken, tokens.refreshToken);
  await authSessionListeners.onRefresh?.(tokens);

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
