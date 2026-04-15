import * as Sentry from "@sentry/nestjs";

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    beforeSend(event) {
      return sanitizeSentryEvent(event);
    }
  });
}

function sanitizeSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const request = event.request;

  if (request) {
    delete request.cookies;
    delete request.data;
    request.headers = sanitizeRecord(request.headers);
  }

  event.extra = sanitizeRecord(event.extra);
  event.contexts = sanitizeRecord(event.contexts) as Sentry.ErrorEvent["contexts"];
  event.tags = sanitizeRecord(event.tags) as Sentry.ErrorEvent["tags"];

  return event;
}

function sanitizeRecord<T>(record: T): T {
  if (!record || typeof record !== "object") {
    return record;
  }

  if (Array.isArray(record)) {
    return record.map((item) => sanitizeRecord(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, "[REDACTED]"];
      }

      return [key, sanitizeRecord(value)];
    })
  ) as T;
}

function isSensitiveKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return [
    "authorization",
    "cookie",
    "password",
    "passwordhash",
    "refreshtoken",
    "refreshtokenhash",
    "token",
    "jwt_secret",
    "database_url",
    "sentry_dsn"
  ].some((sensitiveKey) => normalizedKey.includes(sensitiveKey));
}
