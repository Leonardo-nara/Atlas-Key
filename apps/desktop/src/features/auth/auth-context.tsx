import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { AUTH_EXPIRED_EVENT, ApiError } from "../../lib/http";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens
} from "../../lib/storage";
import type { AuthUser, Store } from "../../types/api";
import { authService } from "./auth-service";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  store: Store | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      void refreshSession().then((refreshed) => {
        if (!refreshed) {
          setLoginError("Sua sessao expirou. Entre novamente para continuar.");
        }
      });
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!refreshToken) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshSession(refreshToken);
    }, 10 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [refreshToken]);

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
      const [nextUser, nextStore] = await Promise.all([
        authService.me(authToken),
        authService.myStore(authToken)
      ]);
      setUser(nextUser);
      setStore(nextStore);
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
      setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
      const nextStore = await authService.myStore(response.accessToken);
      setStore(nextStore);
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
      const nextStore = await authService.myStore(response.accessToken);

      setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(response.user);
      setStore(nextStore);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      store,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      isLoggingIn,
      loginError,
      login,
      logout,
      refreshProfile
    }),
    [token, user, store, isBootstrapping, isLoggingIn, loginError]
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
