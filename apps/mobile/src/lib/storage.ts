import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "delivery-platform.mobile.access-token";
const REFRESH_TOKEN_KEY = "delivery-platform.mobile.refresh-token";
const LEGACY_TOKEN_KEY = "delivery-platform.mobile.token";

export async function getStoredToken() {
  return getStoredAccessToken();
}

export async function getStoredAccessToken() {
  const secureToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  if (secureToken) {
    return secureToken;
  }

  const legacyToken =
    (await SecureStore.getItemAsync(LEGACY_TOKEN_KEY)) ??
    (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));

  if (legacyToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacyToken);
    await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  return legacyToken;
}

export async function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

export async function setStoredTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

export async function clearStoredToken() {
  await clearStoredTokens();
}

export async function clearStoredTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}
