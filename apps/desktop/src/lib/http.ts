import type { ApiErrorPayload } from "../types/api";
import { env } from "./env";

export const AUTH_EXPIRED_EVENT = "desktop-auth-expired";

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
  let response: Response;

  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      }
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao backend. Verifique a URL da API e sua conexão.",
      0
    );
  }

  if (!response.ok) {
    const payload = (await tryParseJson<ApiErrorPayload>(response)) ?? {};
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? "Erro inesperado na API";

    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function tryParseJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
