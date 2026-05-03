import { env } from "./env";

export function toMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (url.startsWith("/")) {
    return `${env.apiUrl}${url}`;
  }

  return url;
}
