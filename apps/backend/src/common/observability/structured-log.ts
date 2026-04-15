import { Logger } from "@nestjs/common";

type LogLevel = "debug" | "error" | "log" | "warn";

interface StructuredLogInput {
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

export function structuredLog(
  logger: Logger,
  level: LogLevel,
  input: StructuredLogInput
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...input
  });

  if (level === "error") {
    logger.error(payload);
    return;
  }

  logger[level](payload);
}
