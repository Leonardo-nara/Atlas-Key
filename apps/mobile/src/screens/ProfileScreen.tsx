import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  CourierButton,
  CourierCard,
  CourierHeader,
  CourierScreen,
  MetricCard,
  SectionTitle,
  StatusPill,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";
import { toMediaUrl } from "../lib/media-url";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";

type AppStackParamList = {
  CourierTabs: undefined;
  CompleteProfile: { forceCompletion: boolean } | undefined;
};

export function ProfileScreen() {
  const { logout, logoutAll, refreshProfile, token, user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const bottomPadding = useTabContentBottomPadding();
  const roleLabel = user?.role === "COURIER" ? "Motoboy" : user?.role;
  const profilePhotoUrl = user?.courierProfile?.profilePhotoUrl
    ? toMediaUrl(user.courierProfile.profilePhotoUrl)
    : null;

  function confirmLogoutAll() {
    Alert.alert(
      "Sair de todos os dispositivos?",
      "Todas as sessões ativas desta conta serão encerradas.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair de todos", style: "destructive", onPress: () => void logoutAll() }
      ]
    );
  }

  return (
    <CourierScreen>
      <CourierHeader
        description="Dados operacionais, veículo, sessão e status do cadastro."
        title="Perfil"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <CourierCard style={styles.heroCard}>
          {profilePhotoUrl ? (
            <Image
              source={{
                uri: profilePhotoUrl,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(user?.name ?? "M").slice(0, 1)}
              </Text>
            </View>
          )}

          <View style={styles.heroCopy}>
            <StatusPill
              label={
                user?.profileCompleted
                  ? "Pronto para operar"
                  : "Perfil incompleto"
              }
              tone={user?.profileCompleted ? "success" : "warning"}
            />
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </CourierCard>

        <View style={styles.metricsRow}>
          <MetricCard label="Perfil" value={roleLabel ?? "-"} />
          <MetricCard
            label="Cadastro"
            value={user?.profileCompleted ? "Completo" : "Pendente"}
          />
        </View>

        <CourierCard>
          <SectionTitle
            description="Informações usadas pelas empresas durante a operação."
            title="Dados operacionais"
          />

          <InfoRow label="Telefone" value={user?.phone ?? "Não informado"} />
          <InfoRow
            label="Cidade"
            value={user?.courierProfile?.city ?? "Não informada"}
          />
          <InfoRow
            label="Tipo de veículo"
            value={user?.courierProfile?.vehicleType ?? "Não informado"}
          />
          <InfoRow
            label="Modelo do veículo"
            value={user?.courierProfile?.vehicleModel ?? "Não informado"}
          />
          <InfoRow
            label="Placa"
            value={user?.courierProfile?.plate ?? "Não informada"}
          />
        </CourierCard>

        {user?.courierProfile?.vehiclePhotoUrl ? (
          <CourierCard>
            <SectionTitle title="Foto do veículo" />
            <Image
              source={{ uri: user.courierProfile.vehiclePhotoUrl }}
              style={styles.vehicleImage}
            />
          </CourierCard>
        ) : null}

        <CourierCard>
          <SectionTitle
            description="Mantenha seu cadastro atualizado antes de aceitar entregas."
            title="Ações da conta"
          />
          <CourierButton
            label="Editar perfil"
            onPress={() =>
              navigation.navigate("CompleteProfile", { forceCompletion: false })
            }
          />
          <CourierButton
            label="Atualizar dados"
            onPress={() => void refreshProfile()}
            variant="secondary"
          />
          <CourierButton label="Sair" onPress={() => void logout()} variant="secondary" />
          <CourierButton
            label="Sair de todos os dispositivos"
            onPress={confirmLogoutAll}
            variant="danger"
          />
        </CourierCard>
      </ScrollView>
    </CourierScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: courierTheme.colors.surfaceElevated
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: courierTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.32)"
  },
  avatarInitial: {
    color: courierTheme.colors.primary,
    fontSize: 30,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroCopy: {
    flex: 1,
    gap: 6
  },
  name: {
    color: courierTheme.colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  email: {
    color: courierTheme.colors.textMuted,
    lineHeight: 20
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  infoRow: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: courierTheme.colors.border
  },
  infoLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: courierTheme.colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  vehicleImage: {
    width: "100%",
    height: 180,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.surfaceElevated
  }
});
