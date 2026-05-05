import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  AUTH_EXPIRED_EVENT,
  AUTH_REFRESHED_EVENT,
  ApiError
} from "../../lib/http";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens
} from "../../lib/storage";
import { env } from "../../lib/env";
import type { AuthUser, Store } from "../../types/api";
import { authService } from "./auth-service";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  store: Store | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerStoreQuick: (
    storeName: string,
    ownerName: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  uploadStoreImage: (file: File) => Promise<void>;
  removeStoreImage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      clearSession();
      setLoginError("Sua sessao expirou. Entre novamente para continuar.");
    }

    function handleAuthRefreshed(event: Event) {
      const tokens = (event as CustomEvent<{ accessToken: string; refreshToken: string }>)
        .detail;

      setToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    window.addEventListener(AUTH_REFRESHED_EVENT, handleAuthRefreshed);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
      window.removeEventListener(AUTH_REFRESHED_EVENT, handleAuthRefreshed);
    };
  }, []);

  async function bootstrapSession() {
    const storedAccessToken = getStoredAccessToken();
    const storedRefreshToken = getStoredRefreshToken();

    setRefreshToken(storedRefreshToken);

    if (storedAccessToken) {
      setToken(storedAccessToken);
      await loadProfile(storedAccessToken, storedRefreshToken);
    } else if (storedRefreshToken) {
      await refreshSession(storedRefreshToken);
    }

    setIsBootstrapping(false);
  }

  async function loadProfile(authToken: string, fallbackRefreshToken?: string | null) {
    try {
      const nextUser = await authService.me(authToken);
      const nextStore = await loadStoreForUser(nextUser, authToken);
      setUser(nextUser);
      setStore(nextStore);
      logAuthDebug(nextUser, resolveRouteForUser(nextUser));
      setLoginError(null);
    } catch (error) {
      if (fallbackRefreshToken && error instanceof ApiError && error.status === 401) {
        const refreshed = await refreshSession(fallbackRefreshToken);

        if (refreshed) {
          return;
        }
      }

      clearSession();
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Nao foi possivel restaurar a sessao.");
      }
    }
  }

  async function login(email: string, password: string) {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await authService.login({ email, password });
      const nextStore = await loadStoreForUser(response.user, response.accessToken);
      setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
      setStore(nextStore);
      logAuthDebug(response.user, resolveRouteForUser(response.user));
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Nao foi possivel fazer login.");
      }
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function registerStoreQuick(
    storeName: string,
    ownerName: string,
    email: string,
    password: string
  ) {
    setIsRegistering(true);
    setLoginError(null);

    try {
      const response = await authService.registerStoreQuick({
        storeName,
        ownerName,
        email,
        password
      });
      const nextStore = await loadStoreForUser(response.user, response.accessToken);
      setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
      setStore(nextStore);
      logAuthDebug(response.user, resolveRouteForUser(response.user));
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Nao foi possivel criar a conta agora.");
      }
      throw error;
    } finally {
      setIsRegistering(false);
    }
  }

  async function logout() {
    const tokenToRevoke = refreshToken ?? getStoredRefreshToken();

    try {
      if (tokenToRevoke) {
        await authService.logout(tokenToRevoke);
      }
    } finally {
      clearSession();
    }
  }

  async function logoutAll() {
    if (!token) {
      clearSession();
      return;
    }

    try {
      await authService.logoutAll(token);
    } finally {
      clearSession();
    }
  }

  function clearSession() {
    clearStoredTokens();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setStore(null);
  }

  async function refreshSession(nextRefreshToken = refreshToken) {
    if (!nextRefreshToken) {
      clearSession();
      return false;
    }

    try {
      const response = await authService.refresh(nextRefreshToken);
      const nextStore = await loadStoreForUser(response.user, response.accessToken);

      setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
      setStore(nextStore);
      logAuthDebug(response.user, resolveRouteForUser(response.user));
      setLoginError(null);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  async function refreshProfile() {
    if (!token) {
      return;
    }

    await loadProfile(token, refreshToken);
  }

  async function loadStoreForUser(nextUser: AuthUser, authToken: string) {
    if (nextUser.role === "PLATFORM_ADMIN") {
      return null;
    }

    if (nextUser.role !== "STORE_ADMIN") {
      throw new ApiError("Este perfil nao tem acesso ao desktop.", 403);
    }

    return authService.myStore(authToken);
  }

  function resolveRouteForUser(nextUser: AuthUser) {
    if (nextUser.role === "PLATFORM_ADMIN") {
      return "/admin/stores";
    }

    if (nextUser.role === "STORE_ADMIN") {
      return "/";
    }

    return "bloqueado-no-desktop";
  }

  function logAuthDebug(nextUser: AuthUser, redirectRoute: string) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[RotaPronta desktop auth]", {
      apiUrl: env.apiUrl,
      email: nextUser.email,
      role: nextUser.role,
      redirectRoute
    });
  }

  async function uploadStoreImage(file: File) {
    if (!token) {
      return;
    }

    const nextStore = await authService.uploadStoreImage(token, file);
    setStore(nextStore);
  }

  async function removeStoreImage() {
    if (!token) {
      return;
    }

    await authService.removeStoreImage(token);
    await refreshProfile();
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      store,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      isLoggingIn,
      isRegistering,
      loginError,
      login,
      registerStoreQuick,
      logout,
      logoutAll,
      refreshProfile,
      uploadStoreImage,
      removeStoreImage
    }),
    [token, user, store, isBootstrapping, isLoggingIn, isRegistering, loginError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
