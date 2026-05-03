import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { catalogService } from "../features/catalog/catalog-service";
import { ApiError } from "../lib/http";
import { toMediaUrl } from "../lib/media-url";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
import { mobileShadow, mobileTheme } from "../theme";
import type { ClientCatalogStore } from "../types/api";

type ClientStackParamList = {
  ClientStores: undefined;
  ClientStoreProducts: { storeId: string; storeName: string };
};

export function ClientStoresScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const bottomPadding = useTabContentBottomPadding();
  const [stores, setStores] = useState<ClientCatalogStore[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStores();
  }, []);

  async function loadStores(nextSearch?: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await catalogService.listStores(nextSearch);
      setStores(response);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Não foi possível carregar as empresas agora."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer contentStyle={{ paddingBottom: bottomPadding }} scrollable>
      <SectionHeader
        title="Empresas"
        description="Escolha uma empresa para ver os produtos disponiveis no catalogo."
      />

      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Buscar empresa</Text>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={() => void loadStores(search)}
          placeholder="Digite o nome da empresa"
          placeholderTextColor={mobileTheme.colors.textSoft}
          style={styles.searchInput}
          value={search}
        />
        <Pressable onPress={() => void loadStores(search)} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Pesquisar</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.feedbackError}>
          <Text style={styles.feedbackErrorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Carregando empresas...</Text>
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Nenhuma empresa encontrada no momento.
          </Text>
        </View>
      ) : (
        stores.map((store) => (
          <Pressable
            key={store.id}
            onPress={() =>
              navigation.navigate("ClientStoreProducts", {
                storeId: store.id,
                storeName: store.name
              })
            }
            style={({ pressed }) => [
              styles.storeCard,
              pressed ? styles.storeCardPressed : undefined
            ]}
          >
            {store.imageUrl ? (
              <Image
                source={{ uri: toMediaUrl(store.imageUrl) ?? undefined }}
                style={styles.storeImage}
              />
            ) : (
              <View style={styles.storeImagePlaceholder}>
                <Text style={styles.storeImagePlaceholderText}>
                  {store.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeAddress}>
              {store.address || "Endereço ainda não informado pela empresa"}
            </Text>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchCard: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  searchLabel: {
    color: mobileTheme.colors.text,
    fontWeight: "700"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    color: mobileTheme.colors.text
  },
  searchButton: {
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center"
  },
  searchButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  storeCard: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  storeImage: {
    width: "100%",
    height: 138,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surfaceStrong
  },
  storeImagePlaceholder: {
    height: 138,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  storeImagePlaceholderText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "900",
    fontSize: 36
  },
  storeCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }]
  },
  storeName: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  storeAddress: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 20
  },
  emptyState: {
    padding: 18,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border
  },
  emptyStateText: {
    color: mobileTheme.colors.textMuted,
    textAlign: "center"
  },
  feedbackError: {
    padding: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.dangerSoft
  },
  feedbackErrorText: {
    color: mobileTheme.colors.danger
  }
});
