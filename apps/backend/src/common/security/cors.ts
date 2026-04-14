const DEFAULT_LOCAL_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "exp://127.0.0.1:8081",
  "exp://localhost:8081"
];

export function getAllowedCorsOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return DEFAULT_LOCAL_CORS_ORIGINS;
}

export function isCorsOriginAllowed(origin: string | undefined) {
  if (!origin) {
    return true;
  }

  if (origin === "file://" || origin === "null") {
    return true;
  }

  const allowedOrigins = getAllowedCorsOrigins();

  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.includes(origin);
}
