function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function deriveSocketUrl(apiUrl: string) {
  return normalizeUrl(apiUrl).replace(/\/api$/, "");
}

const apiUrl = normalizeUrl(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api"
);

export const mobileEnv = {
  apiUrl,
  socketUrl: normalizeUrl(
    process.env.EXPO_PUBLIC_SOCKET_URL ?? deriveSocketUrl(apiUrl)
  )
};
