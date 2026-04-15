import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { securityMetrics } from "./security-metrics";
import { structuredLog } from "./structured-log";

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseLike {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  on: (event: "finish", listener: () => void) => void;
}

const logger = new Logger("HttpRequest");

export function requestLoggingMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: () => void
) {
  const startedAt = Date.now();
  const incomingRequestId = getHeader(request, "x-request-id");
  const requestId = incomingRequestId || randomUUID();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  response.on("finish", () => {
    const path = sanitizePath(request.originalUrl ?? request.url ?? "");
    const durationMs = Date.now() - startedAt;

    securityMetrics.recordRequest({
      requestId,
      method: request.method,
      path,
      statusCode: response.statusCode,
      durationMs
    });

    structuredLog(logger, "log", {
      event: "http_request",
      requestId,
      method: request.method,
      path,
      statusCode: response.statusCode,
      durationMs,
      ipAddress: request.ip,
      userAgent: getHeader(request, "user-agent")
    });
  });

  next();
}

function getHeader(request: RequestLike, name: string) {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
}

function sanitizePath(path: string) {
  return path.split("?")[0];
}
