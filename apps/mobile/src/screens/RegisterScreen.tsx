import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export function RegisterScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isRegistering, loginError, registerCourier } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleRegister() {
    setLocalError(null);

    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setLocalError("Preencha nome, email, telefone e senha.");
      return;
    }

    if (password.trim().length < 6) {
      setLocalError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("A confirmacao de senha nao confere.");
      return;
    }

    try {
      await registerCourier(name.trim(), email.trim(), phone.trim(), password);
    } catch {
      setLocalError("Nao foi possivel concluir o cadastro agora.");
    }
  }

  return (
    <ScreenContainer scrollable>
      <View style={styles.container}>
        <SectionHeader
          title="Cadastro do motoboy"
          description="Crie sua conta para entrar no app e completar seu perfil operacional."
        />

        <View style={styles.card}>
          <Field label="Nome completo" value={name} onChangeText={setName} />
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            keyboardType="phone-pad"
            label="Telefone"
            value={phone}
            onChangeText={setPhone}
          />
          <Field
            label="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label="Confirmar senha"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {loginError || localError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loginError ?? localError}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={isRegistering}
            onPress={() => void handleRegister()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.buttonPressed : undefined,
              isRegistering ? styles.buttonDisabled : undefined
            ]}
          >
            <Text style={styles.primaryText}>
              {isRegistering ? "Criando conta..." : "Criar conta"}
            </Text>
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Ja tenho conta</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  primaryButton: {
    backgroundColor: "#b65b1c",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: "#efe1ca",
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
  primaryText: {
    color: "#fffaf0",
    fontWeight: "700",
    fontSize: 16
  },
  secondaryText: {
    color: "#8a5a00",
    fontWeight: "700"
  }
});
