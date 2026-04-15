import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { mobileEnv } from "../env";

type AppStackParamList = {
  CourierTabs: undefined;
  CompleteProfile: { forceCompletion: boolean } | undefined;
};

export function ProfileScreen() {
  const { logout, logoutAll, refreshProfile, user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
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

        <Text style={styles.label}>Cidade</Text>
        <Text style={styles.value}>{user?.courierProfile?.city ?? "Nao informada"}</Text>

        <Text style={styles.label}>Tipo de veiculo</Text>
        <Text style={styles.value}>{user?.courierProfile?.vehicleType ?? "Nao informado"}</Text>

        <Text style={styles.label}>Modelo do veiculo</Text>
        <Text style={styles.value}>{user?.courierProfile?.vehicleModel ?? "Nao informado"}</Text>

        <Text style={styles.label}>Placa</Text>
        <Text style={styles.value}>{user?.courierProfile?.plate ?? "Nao informada"}</Text>

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
            <Text style={styles.label}>Foto do veiculo</Text>
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
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: "#efe1ca",
    marginBottom: 12
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
