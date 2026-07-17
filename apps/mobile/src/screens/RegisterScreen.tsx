import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  CourierButton,
  CourierCard,
  CourierHeader,
  CourierScreen,
  FeedbackBanner,
  SectionTitle,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";

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
    <CourierScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CourierHeader
          description="Crie sua conta e complete os dados operacionais antes de solicitar vínculo com empresas."
          title="Cadastro do motoboy"
        />

        <CourierCard>
          <SectionTitle
            description="Depois desta etapa, você informa cidade, veículo e foto de apoio."
            title="Conta de acesso"
          />

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
            <FeedbackBanner message={loginError ?? localError ?? ""} tone="danger" />
          ) : null}

          <CourierButton
            disabled={isRegistering}
            label={isRegistering ? "Criando conta..." : "Criar conta"}
            onPress={() => void handleRegister()}
          />
          <CourierButton
            label="Já tenho conta"
            onPress={() => navigation.goBack()}
            variant="secondary"
          />
        </CourierCard>
      </ScrollView>
    </CourierScreen>
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
        placeholderTextColor={courierTheme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 32
  },
  field: {
    gap: 8
  },
  label: {
    color: courierTheme.colors.text,
    fontWeight: "800"
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: courierTheme.colors.border,
    borderRadius: courierTheme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: courierTheme.colors.backgroundSecondary,
    color: courierTheme.colors.text
  }
});
