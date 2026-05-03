import { mobileEnv } from "../env";

export function toMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (url.startsWith("/")) {
    return `${mobileEnv.apiUrl}${url}`;
  }

  return url;
}
