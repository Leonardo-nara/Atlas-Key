import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "../features/auth/auth-context";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isLoggingIn, login, loginError } = useAuth();
  const [email, setEmail] = useState("courier@example.com");
  const [password, setPassword] = useState("StrongPass123");
  const [localError, setLocalError] = useState<string | null>(null);

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
        "Não foi possível entrar agora. Verifique a conta do motoboy e a conexão com o backend."
      );
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <SectionHeader
          title="App do motoboy"
          description="Entre com sua conta de motoboy para ver pedidos disponíveis e atualizar o andamento das entregas. Para demonstração local, a conta padrão é courier@example.com."
        />

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="courier@example.com"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              onChangeText={setPassword}
              placeholder="Sua senha"
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

          <Pressable onPress={() => navigation.navigate("Register")} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Criar conta de motoboy</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 24
  },
  card: {
    backgroundColor: "#fffaf0",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#ead8b2"
  },
  field: {
    gap: 8
  },
  label: {
    fontWeight: "600",
    color: "#1f2933"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8c7aa",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff"
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff1f1"
  },
  errorText: {
    color: "#a82929"
  },
  button: {
    backgroundColor: "#b65b1c",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  buttonPressed: {
    opacity: 0.9
  },
  buttonDisabled: {
    opacity: 0.6
  },
  secondaryButton: {
    backgroundColor: "#efe1ca",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  secondaryText: {
    color: "#8a5a00",
    fontWeight: "700"
  },
  buttonText: {
    color: "#fffaf0",
    fontWeight: "700",
    fontSize: 16
  }
});
