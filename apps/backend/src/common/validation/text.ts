export function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

