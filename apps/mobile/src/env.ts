function deriveSocketUrl(apiUrl: string) {
  return apiUrl.replace(/\/api\/?$/, "");
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const mobileEnv = {
  apiUrl,
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? deriveSocketUrl(apiUrl)
};
