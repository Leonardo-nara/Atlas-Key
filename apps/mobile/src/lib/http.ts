import { mobileEnv } from "../env";
import type { ApiErrorPayload } from "../types/api";

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
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      }
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar ao backend. Confira o IP ou domínio configurado no app.",
      0
    );
  }

  if (!response.ok) {
    const payload = (await tryParseJson<ApiErrorPayload>(response)) ?? {};
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message ?? payload.error ?? "Erro inesperado na API";

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
