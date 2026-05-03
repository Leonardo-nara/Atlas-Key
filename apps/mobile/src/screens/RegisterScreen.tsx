import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { mobileShadow, mobileTheme } from "../theme";

type AuthStackParamList = {
  Login: undefined;
  RegisterCourier: undefined;
  RegisterClient: undefined;
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
      setLocalError("A confirmação de senha não confere.");
      return;
    }

    try {
      await registerCourier(name.trim(), email.trim(), phone.trim(), password);
    } catch {
      setLocalError("Não foi possível concluir o cadastro agora.");
    }
  }

  return (
    <ScreenContainer scrollable>
      <View style={styles.container}>
        <SectionHeader
          title="Cadastro do motoboy"
          description="Crie sua conta para entrar no app e completar o perfil operacional em seguida."
        />

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>Cadastro em poucos passos</Text>
          <Text style={styles.tipText}>
            Depois desta etapa, você ainda completa cidade, veículo e dados de
            apoio para ficar pronto para operar.
          </Text>
        </View>

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

          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.secondaryButton}
          >
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
        placeholderTextColor={mobileTheme.colors.textSoft}
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
  tipBox: {
    gap: 8,
    padding: 18,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  tipTitle: {
    color: mobileTheme.colors.text,
    fontWeight: "800"
  },
  tipText: {
    color: mobileTheme.colors.textMuted,
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
  primaryButton: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center"
  },
  secondaryButton: {
    backgroundColor: mobileTheme.colors.primarySoft,
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
  primaryText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16
  },
  secondaryText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800"
  }
});
