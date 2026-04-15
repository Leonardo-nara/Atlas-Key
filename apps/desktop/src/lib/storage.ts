const ACCESS_TOKEN_KEY = "delivery-platform.desktop.access-token";
const REFRESH_TOKEN_KEY = "delivery-platform.desktop.refresh-token";
const LEGACY_TOKEN_KEY = "delivery-platform.desktop.token";

export function getStoredToken() {
  return getStoredAccessToken();
}

export function getStoredAccessToken() {
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
    window.localStorage.getItem(LEGACY_TOKEN_KEY)
  );
}

export function getStoredRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearStoredToken() {
  clearStoredTokens();
}

export function clearStoredTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}
