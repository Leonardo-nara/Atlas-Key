import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { mobileEnv } from "../env";

export function ProfileScreen() {
  const { logout, refreshProfile, user } = useAuth();
  const roleLabel = user?.role === "COURIER" ? "Motoboy" : user?.role;

  return (
    <ScreenContainer scrollable>
      <SectionHeader
        title="Perfil"
        description="Dados da conta autenticada e utilitários básicos do app. Em piloto, confirme aqui se a API aponta para um endereço acessível pelo celular."
      />

      <View style={styles.card}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Telefone</Text>
        <Text style={styles.value}>{user?.phone}</Text>

        <Text style={styles.label}>Perfil</Text>
        <Text style={styles.value}>{roleLabel}</Text>

        <Text style={styles.label}>API</Text>
        <Text style={styles.value}>{mobileEnv.apiUrl}</Text>
      </View>

      <Pressable onPress={() => void refreshProfile()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Atualizar perfil</Text>
      </Pressable>

      <Pressable onPress={() => void logout()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Sair</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fffaf0",
    borderRadius: 24,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ead8b2"
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#8a5a00"
  },
  value: {
    fontSize: 16,
    color: "#1f2933",
    marginBottom: 8
  },
  primaryButton: {
    backgroundColor: "#b65b1c",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  primaryText: {
    color: "#fffaf0",
    fontWeight: "700"
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
  }
});
