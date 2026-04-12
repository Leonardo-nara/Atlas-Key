function normalizeUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function deriveSocketUrl(apiUrl: string) {
  return normalizeUrl(apiUrl).replace(/\/api$/, "");
}

const apiUrl = normalizeUrl(
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
);

export const env = {
  apiUrl,
  socketUrl: normalizeUrl(
    import.meta.env.VITE_SOCKET_URL ?? deriveSocketUrl(apiUrl)
  )
};
