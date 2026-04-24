import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as AuthSession from "expo-auth-session";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { mobileEnv } from "../env";
import { mobileShadow, mobileTheme } from "../theme";

type AuthStackParamList = {
  Login: undefined;
  RegisterCourier: undefined;
  RegisterClient: undefined;
};

type LoginMode = "courier" | "client";

export function LoginScreen() {
  const isDevelopment = __DEV__;
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isLoggingIn, isGoogleLoggingIn, login, loginWithGoogle, loginError } = useAuth();
  const [mode, setMode] = useState<LoginMode>("courier");
  const [email, setEmail] = useState(isDevelopment ? "courier@example.com" : "");
  const [password, setPassword] = useState(isDevelopment ? "StrongPass123" : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: "deliveryplatformcourier",
        path: "oauthredirect"
      }),
    []
  );
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: mobileEnv.googleAndroidClientId,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      usePKCE: false,
      extraParams: {
        prompt: "select_account"
      }
    },
    discovery
  );

  useEffect(() => {
    async function handleGoogleResponse() {
      if (!response || response.type !== "success") {
        return;
      }

      const idToken = response.params.id_token;

      if (!idToken) {
        setLocalError("O Google nao retornou uma credencial valida para continuar.");
        return;
      }

      try {
        await loginWithGoogle(idToken);
      } catch {
        setLocalError("Nao foi possivel concluir o acesso com Google.");
      }
    }

    void handleGoogleResponse();
  }, [loginWithGoogle, response]);

  async function handleLogin() {
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Preencha email e senha para continuar.");
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      setLocalError(
        mode === "courier"
          ? "Nao foi possivel entrar agora. Verifique a conta do motoboy e a conexao com o backend."
          : "Nao foi possivel entrar agora. Verifique a conta do cliente e a conexao com o backend."
      );
    }
  }

  async function handleGoogleLogin() {
    setLocalError(null);

    if (mode !== "courier") {
      setLocalError("O acesso com Google esta disponivel apenas para motoboys.");
      return;
    }

    if (!mobileEnv.googleAndroidClientId) {
      setLocalError("Google login ainda nao foi configurado para este app.");
      return;
    }

    if (!request) {
      setLocalError("O acesso com Google ainda esta sendo preparado. Tente novamente em alguns segundos.");
      return;
    }

    try {
      await promptAsync();
    } catch {
      setLocalError("Nao foi possivel abrir o acesso com Google agora.");
    }
  }

  return (
    <ScreenContainer scrollable>
      <View style={styles.container}>
        <SectionHeader
          title={mode === "courier" ? "App do motoboy" : "Area do cliente"}
          description={
            mode === "courier"
              ? "Entre com sua conta para ver pedidos disponiveis, acompanhar status e operar em empresas aprovadas."
              : "Entre como cliente para ver empresas cadastradas e consultar os produtos disponiveis."
          }
        />

        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => {
              setMode("courier");
              setLocalError(null);
            }}
            style={[styles.modeChip, mode === "courier" ? styles.modeChipActive : undefined]}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "courier" ? styles.modeChipTextActive : undefined
              ]}
            >
              Quero ser motoboy
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("client");
              setLocalError(null);
            }}
            style={[styles.modeChip, mode === "client" ? styles.modeChipActive : undefined]}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "client" ? styles.modeChipTextActive : undefined
              ]}
            >
              Sou cliente
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroStrip}>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>Operacao em movimento</Text>
          </View>
          <Text style={styles.heroText}>
            Sessao segura, pedidos em tempo real e uma interface mais clara para o
            uso diario na rua.
          </Text>
        </View>

        {mode === "courier" && !mobileEnv.googleAndroidClientId ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Entrar com Google ainda nao foi configurado neste build do app.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="courier@example.com"
              placeholderTextColor={mobileTheme.colors.textSoft}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={mobileTheme.colors.textSoft}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {loginError || localError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loginError ?? localError}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={isLoggingIn}
            onPress={() => void handleLogin()}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : undefined,
              isLoggingIn ? styles.buttonDisabled : undefined
            ]}
          >
            <Text style={styles.buttonText}>
              {isLoggingIn ? "Entrando..." : "Entrar"}
            </Text>
          </Pressable>

          {mode === "courier" ? (
            <Pressable
              disabled={isGoogleLoggingIn}
              onPress={() => void handleGoogleLogin()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed ? styles.buttonPressed : undefined,
                isGoogleLoggingIn ? styles.buttonDisabled : undefined
              ]}
            >
              <Text style={styles.googleButtonText}>
                {isGoogleLoggingIn
                  ? "Conectando ao Google..."
                  : !request && mobileEnv.googleAndroidClientId
                    ? "Preparando Google..."
                    : "Entrar com Google"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() =>
              navigation.navigate(mode === "courier" ? "RegisterCourier" : "RegisterClient")
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              {mode === "courier" ? "Criar conta de motoboy" : "Criar conta de cliente"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24
  },
  warningBox: {
    padding: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.warningSoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  warningText: {
    color: mobileTheme.colors.warning
  },
  modeToggle: {
    flexDirection: "row",
    gap: 10
  },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    alignItems: "center"
  },
  modeChipActive: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    borderColor: mobileTheme.colors.primaryStrong
  },
  modeChipText: {
    color: mobileTheme.colors.textMuted,
    fontWeight: "800",
    fontSize: 13
  },
  modeChipTextActive: {
    color: "#ffffff"
  },
  heroStrip: {
    gap: 10,
    padding: 18,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  heroChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: "#ffffff"
  },
  heroChipText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase"
  },
  heroText: {
    color: mobileTheme.colors.text,
    lineHeight: 21
  },
  card: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  field: {
    gap: 8
  },
  label: {
    fontWeight: "700",
    color: mobileTheme.colors.text
  },
  input: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    color: mobileTheme.colors.text
  },
  errorBox: {
    padding: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.dangerSoft
  },
  errorText: {
    color: mobileTheme.colors.danger
  },
  button: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center"
  },
  googleButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }]
  },
  buttonDisabled: {
    opacity: 0.6
  },
  secondaryButton: {
    backgroundColor: mobileTheme.colors.primarySoft,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  secondaryText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800"
  },
  googleButtonText: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    fontSize: 15
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16
  }
});
