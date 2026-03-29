function deriveSocketUrl(apiUrl: string) {
  return apiUrl.replace(/\/api\/?$/, "");
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export const env = {
  apiUrl,
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? deriveSocketUrl(apiUrl)
};
