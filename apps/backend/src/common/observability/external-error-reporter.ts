import * as Sentry from "@sentry/nestjs";

interface ErrorReportInput {
  exception: unknown;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
}

export function reportUnhandledError(input: ErrorReportInput) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (input.method) {
      scope.setTag("http_method", input.method);
    }

    if (input.path) {
      scope.setTag("http_path", input.path);
    }

    if (input.statusCode) {
      scope.setTag("http_status_code", String(input.statusCode));
    }

    if (input.requestId) {
      scope.setTag("request_id", input.requestId);
    }

    scope.setContext("request", {
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode
    });
    scope.setLevel("error");
    Sentry.captureException(input.exception);
  });
}
