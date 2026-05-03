import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { mobileEnv } from "../env";
import { useAuth } from "../features/auth/auth-context";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
import { mobileShadow, mobileTheme } from "../theme";

type AppStackParamList = {
  CourierTabs: undefined;
  CompleteProfile: { forceCompletion: boolean } | undefined;
};

export function ProfileScreen() {
  const { logout, logoutAll, refreshProfile, user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const bottomPadding = useTabContentBottomPadding();
  const roleLabel = user?.role === "COURIER" ? "Motoboy" : user?.role;

  return (
    <ScreenContainer contentStyle={{ paddingBottom: bottomPadding }} scrollable>
      <SectionHeader
        title="Perfil"
        description="Dados da conta autenticada e utilitários do app. Aqui você acompanha o perfil operacional e controla a sessão."
      />

      <View style={styles.card}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {user?.profileCompleted ? "Perfil pronto para operar" : "Perfil ainda incompleto"}
          </Text>
        </View>

        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{user?.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>

        <Text style={styles.label}>Telefone</Text>
        <Text style={styles.value}>{user?.phone}</Text>

        <Text style={styles.label}>Perfil</Text>
        <Text style={styles.value}>{roleLabel}</Text>

        <Text style={styles.label}>Cidade</Text>
        <Text style={styles.value}>{user?.courierProfile?.city ?? "Não informada"}</Text>

        <Text style={styles.label}>Tipo de veículo</Text>
        <Text style={styles.value}>{user?.courierProfile?.vehicleType ?? "Não informado"}</Text>

        <Text style={styles.label}>Modelo do veículo</Text>
        <Text style={styles.value}>{user?.courierProfile?.vehicleModel ?? "Não informado"}</Text>

        <Text style={styles.label}>Placa</Text>
        <Text style={styles.value}>{user?.courierProfile?.plate ?? "Não informada"}</Text>

        <Text style={styles.label}>Perfil operacional</Text>
        <Text style={styles.value}>
          {user?.profileCompleted ? "Completo" : "Pendente de conclusao"}
        </Text>

        {user?.courierProfile?.profilePhotoUrl ? (
          <>
            <Text style={styles.label}>Foto de perfil</Text>
            <Image
              source={{ uri: user.courierProfile.profilePhotoUrl }}
              style={styles.imagePreview}
            />
          </>
        ) : null}

        {user?.courierProfile?.vehiclePhotoUrl ? (
          <>
            <Text style={styles.label}>Foto do veículo</Text>
            <Image
              source={{ uri: user.courierProfile.vehiclePhotoUrl }}
              style={styles.imagePreview}
            />
          </>
        ) : null}

        <Text style={styles.label}>API</Text>
        <Text style={styles.value}>{mobileEnv.apiUrl}</Text>
      </View>

      <Pressable
        onPress={() => navigation.navigate("CompleteProfile", { forceCompletion: false })}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryText}>Editar perfil</Text>
      </Pressable>

      <Pressable onPress={() => void refreshProfile()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Atualizar perfil</Text>
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
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.primarySoft,
    marginBottom: 4
  },
  statusPillText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 12
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
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.surfaceStrong,
    marginBottom: 12
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
