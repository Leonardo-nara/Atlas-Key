import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { courierService } from "../courier/courier-service";
import { ApiError, setAuthSessionListeners } from "../../lib/http";
import type { PickedImageFile } from "../../lib/image-picker";
import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens
} from "../../lib/storage";
import type { AuthUser } from "../../types/api";
import { authService } from "./auth-service";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  isCourier: boolean;
  isClient: boolean;
  isBootstrapping: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerClient: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;
  registerCourier: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;
  updateCourierProfile: (
    input: Parameters<typeof courierService.updateMe>[1]
  ) => Promise<void>;
  uploadCourierProfileImage: (file: PickedImageFile) => Promise<void>;
  removeCourierProfileImage: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    setAuthSessionListeners({
      onExpired: async () => {
        await clearSession();
        setLoginError("Sua sessão expirou. Entre novamente para continuar.");
      },
      onRefresh: (tokens) => {
        setToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
      }
    });

    return () => setAuthSessionListeners({});
  }, []);

  async function bootstrapSession() {
    const storedAccessToken = await getStoredAccessToken();
    const storedRefreshToken = await getStoredRefreshToken();

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

      if (nextUser.role === "STORE_ADMIN") {
        throw new ApiError("Use o painel desktop para acessar a conta da empresa.", 403);
      }

      setUser(nextUser);
      setLoginError(null);
    } catch (error) {
      if (fallbackRefreshToken && error instanceof ApiError && error.status === 401) {
        const refreshed = await refreshSession(fallbackRefreshToken);

        if (refreshed) {
          return;
        }
      }

      await clearSession();
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
      const nextUser = await authService.me(response.accessToken);

      if (nextUser.role === "STORE_ADMIN") {
        throw new ApiError("Use o painel desktop para acessar a conta da empresa.", 403);
      }

      await setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(nextUser);
    } catch (error) {
      await clearSession();
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
      const nextUser = await authService.me(response.accessToken);

      await setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(nextUser);
    } catch (error) {
      await clearSession();
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Não foi possível concluir seu cadastro.");
      }
      throw error;
    } finally {
      setIsRegistering(false);
    }
  }

  async function registerClient(
    name: string,
    email: string,
    phone: string,
    password: string
  ) {
    setIsRegistering(true);
    setLoginError(null);

    try {
      const response = await authService.registerClient({
        name,
        email,
        phone,
        password
      });
      const nextUser = await authService.me(response.accessToken);

      await setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(nextUser);
    } catch (error) {
      await clearSession();
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError("Não foi possível concluir seu cadastro.");
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
      throw new ApiError("Sessão do motoboy não encontrada.", 401);
    }

    if (user?.role !== "COURIER") {
      throw new ApiError("Este perfil não pertence a um motoboy.", 403);
    }

    const nextUser = await courierService.updateMe(token, input);
    setUser(nextUser);
  }

  async function uploadCourierProfileImage(file: PickedImageFile) {
    if (!token) {
      throw new ApiError("Sessão do motoboy não encontrada.", 401);
    }

    const nextUser = await courierService.uploadProfileImage(token, file);
    setUser(nextUser);
  }

  async function removeCourierProfileImage() {
    if (!token) {
      throw new ApiError("Sessão do motoboy não encontrada.", 401);
    }

    const nextUser = await courierService.removeProfileImage(token);
    setUser(nextUser);
  }

  async function logout() {
    const tokenToRevoke = refreshToken ?? (await getStoredRefreshToken());

    try {
      if (tokenToRevoke) {
        await authService.logout(tokenToRevoke);
      }
    } finally {
      await clearSession();
    }
  }

  async function logoutAll() {
    if (!token) {
      await clearSession();
      return;
    }

    try {
      await authService.logoutAll(token);
    } finally {
      await clearSession();
    }
  }

  async function clearSession() {
    await clearStoredTokens();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }

  async function refreshSession(nextRefreshToken = refreshToken) {
    if (!nextRefreshToken) {
      await clearSession();
      return false;
    }

    try {
      const response = await authService.refresh(nextRefreshToken);
      const nextUser = await authService.me(response.accessToken);

      if (nextUser.role === "STORE_ADMIN") {
        throw new ApiError("Use o painel desktop para acessar a conta da empresa.", 403);
      }

      await setStoredTokens(response.accessToken, response.refreshToken);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser(nextUser);
      setLoginError(null);
      return true;
    } catch {
      await clearSession();
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
      isAuthenticated: Boolean(token && user),
      needsProfileCompletion: Boolean(
        token &&
          user &&
          user.role === "COURIER" &&
          !user.profileCompleted
      ),
      isCourier: user?.role === "COURIER",
      isClient: user?.role === "CLIENT",
      isBootstrapping,
      isLoggingIn,
      isRegistering,
      loginError,
      login,
      registerClient,
      registerCourier,
      updateCourierProfile,
      uploadCourierProfileImage,
      removeCourierProfileImage,
      logout,
      logoutAll,
      refreshProfile
    }),
    [
      token,
      user,
      isBootstrapping,
      isLoggingIn,
      isRegistering,
      loginError
    ]
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
