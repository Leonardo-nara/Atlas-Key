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
  clearStoredToken,
  getStoredToken,
  setStoredToken
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
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setIsBootstrapping(false);
      return;
    }

    void loadProfile(token).finally(() => {
      setIsBootstrapping(false);
    });
  }, [token]);

  useEffect(() => {
    function handleAuthExpired() {
      logout();
      setLoginError("Sua sessão expirou. Entre novamente para continuar.");
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  async function loadProfile(authToken: string) {
    try {
      const [nextUser, nextStore] = await Promise.all([
        authService.me(authToken),
        authService.myStore(authToken)
      ]);
      setUser(nextUser);
      setStore(nextStore);
      setLoginError(null);
    } catch (error) {
      logout();
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Não foi possível restaurar a sessão.");
      }
    }
  }

  async function login(email: string, password: string) {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await authService.login({ email, password });
      setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      const nextStore = await authService.myStore(response.accessToken);
      setStore(nextStore);
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Não foi possível fazer login.");
      }
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setStore(null);
  }

  async function refreshProfile() {
    if (!token) {
      return;
    }

    await loadProfile(token);
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
