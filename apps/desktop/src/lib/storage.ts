const ACCESS_TOKEN_KEY = "delivery-platform.desktop.access-token";
const REFRESH_TOKEN_KEY = "delivery-platform.desktop.refresh-token";
const LEGACY_TOKEN_KEY = "delivery-platform.desktop.token";

interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export function getStoredToken() {
  return getStoredAccessToken();
}

export async function getStoredTokens(): Promise<StoredTokens> {
  const localTokens = getLocalStoredTokens();

  if (localTokens.accessToken && localTokens.refreshToken) {
    return localTokens;
  }

  const secureTokens = await window.mototake?.secureSession?.get?.();

  if (!secureTokens?.accessToken || !secureTokens.refreshToken) {
    return localTokens;
  }

  writeLocalTokens(secureTokens.accessToken, secureTokens.refreshToken);
  return secureTokens;
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
  writeLocalTokens(accessToken, refreshToken);
  void window.mototake?.secureSession?.set?.({ accessToken, refreshToken });
}

export function clearStoredToken() {
  clearStoredTokens();
}

export function clearStoredTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  void window.mototake?.secureSession?.clear?.();
}

function getLocalStoredTokens(): StoredTokens {
  return {
    accessToken: getStoredAccessToken(),
    refreshToken: getStoredRefreshToken()
  };
}

function writeLocalTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}
