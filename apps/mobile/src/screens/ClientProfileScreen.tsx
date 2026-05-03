import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { mobileEnv } from "../env";
import { useAuth } from "../features/auth/auth-context";
import { mobileShadow, mobileTheme } from "../theme";

export function ClientProfileScreen() {
  const { logout, logoutAll, refreshProfile, user } = useAuth();

  return (
    <ScreenContainer scrollable>
      <SectionHeader
        title="Minha conta"
        description="Dados básicos do cliente autenticado e controle da sessão."
      />

      <View style={styles.card}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Telefone</Text>
        <Text style={styles.value}>{user?.phone}</Text>

        <Text style={styles.label}>Perfil</Text>
        <Text style={styles.value}>Cliente</Text>

        <Text style={styles.label}>API</Text>
        <Text style={styles.value}>{mobileEnv.apiUrl}</Text>
      </View>

      <Pressable onPress={() => void refreshProfile()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Atualizar dados</Text>
      </Pressable>

      <Pressable onPress={() => void logout()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Sair</Text>
      </Pressable>

      <Pressable onPress={() => void logoutAll()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Sair de todos os dispositivos</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: mobileTheme.colors.primaryStrong
  },
  value: {
    fontSize: 16,
    color: mobileTheme.colors.text,
    marginBottom: 8
  },
  primaryButton: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center"
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "800"
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
  }
});
