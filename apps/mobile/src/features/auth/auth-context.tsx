import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { courierService } from "../courier/courier-service";
import { ApiError } from "../../lib/http";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken
} from "../../lib/storage";
import type { AuthUser } from "../../types/api";
import { authService } from "./auth-service";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerCourier: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;
  updateCourierProfile: (
    input: Parameters<typeof courierService.updateMe>[1]
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  async function bootstrapSession() {
    const storedToken = await getStoredToken();

    if (!storedToken) {
      setIsBootstrapping(false);
      return;
    }

    setToken(storedToken);
    await loadProfile(storedToken);
    setIsBootstrapping(false);
  }

  async function loadProfile(authToken: string) {
    try {
      const nextUser = await courierService.me(authToken);

      if (nextUser.role !== "COURIER") {
        throw new ApiError("Este app é exclusivo para motoboys.", 403);
      }

      setUser(nextUser);
      setLoginError(null);
    } catch (error) {
      await logout();
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
      const response = await authService.login(email, password);
      const nextUser = await courierService.me(response.accessToken);

      if (nextUser.role !== "COURIER") {
        throw new ApiError("Use uma conta de motoboy para entrar no app.", 403);
      }

      await setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setUser(nextUser);
    } catch (error) {
      await clearStoredToken();
      setToken(null);
      setUser(null);
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

  async function registerCourier(
    name: string,
    email: string,
    phone: string,
    password: string
  ) {
    setIsRegistering(true);
    setLoginError(null);

    try {
      const response = await courierService.register({
        name,
        email,
        phone,
        password
      });
      const nextUser = await courierService.me(response.accessToken);

      await setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setUser(nextUser);
    } catch (error) {
      await clearStoredToken();
      setToken(null);
      setUser(null);
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Nao foi possivel concluir seu cadastro.");
      }
      throw error;
    } finally {
      setIsRegistering(false);
    }
  }

  async function updateCourierProfile(
    input: Parameters<typeof courierService.updateMe>[1]
  ) {
    if (!token) {
      throw new ApiError("Sessao do motoboy nao encontrada.", 401);
    }

    const nextUser = await courierService.updateMe(token, input);
    setUser(nextUser);
  }

  async function logout() {
    await clearStoredToken();
    setToken(null);
    setUser(null);
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
      isAuthenticated: Boolean(token && user),
      needsProfileCompletion: Boolean(token && user && !user.profileCompleted),
      isBootstrapping,
      isLoggingIn,
      isRegistering,
      loginError,
      login,
      registerCourier,
      updateCourierProfile,
      logout,
      refreshProfile
    }),
    [token, user, isBootstrapping, isLoggingIn, isRegistering, loginError]
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
