export function sanitizeLogText(value: string): string {
  return value
    .replace(/(\/storefront\/orders\/)[^\s/?#"'<>]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:trackingToken|publicTrackingToken|accessToken|refreshToken|token|apiKey|api_key)=)[^&#\s"']*/gi, "$1[REDACTED]");
}

export function sanitizeRequestPath(path: string): string {
  return sanitizeLogText(path.split("?")[0]);
}

export function sanitizeLogData<T>(value: T): T {
  if (typeof value === "string") return sanitizeLogText(value) as T;
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => sanitizeLogData(item)) as T;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /authorization|cookie|password|token|api[_-]?key|jwt_secret|database_url|sentry_dsn|secret/i.test(key)
      ? "[REDACTED]" : sanitizeLogData(item)
  ])) as T;
}
