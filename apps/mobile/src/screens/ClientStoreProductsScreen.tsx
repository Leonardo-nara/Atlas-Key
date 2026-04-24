import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { catalogService } from "../features/catalog/catalog-service";
import { ApiError } from "../lib/http";
import { mobileShadow, mobileTheme } from "../theme";
import type { Product, Store } from "../types/api";

type ClientStackParamList = {
  ClientStoreProducts: { storeId: string; storeName: string };
};

export function ClientStoreProductsScreen() {
  const route = useRoute<RouteProp<ClientStackParamList, "ClientStoreProducts">>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProducts();
  }, [route.params.storeId]);

  async function loadProducts(nextSearch?: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await catalogService.getStoreProducts(
        route.params.storeId,
        nextSearch
      );
      setStore(response.store);
      setProducts(response.products);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar os produtos desta empresa."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scrollable>
      <SectionHeader
        title={route.params.storeName}
        description="Pesquise e veja os produtos disponiveis nesta empresa."
      />

      {store ? (
        <View style={styles.storeCard}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeAddress}>
            {store.address || "Endereco ainda nao informado pela empresa"}
          </Text>
        </View>
      ) : null}

      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Buscar produto</Text>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={() => void loadProducts(search)}
          placeholder="Digite o nome do produto"
          placeholderTextColor={mobileTheme.colors.textSoft}
          style={styles.searchInput}
          value={search}
        />
        <Text style={styles.searchHelper}>
          Pesquise por nome, categoria ou descricao.
        </Text>
      </View>

      {error ? (
        <View style={styles.feedbackError}>
          <Text style={styles.feedbackErrorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Carregando produtos...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Nenhum produto disponivel nesta empresa com esse filtro.
          </Text>
        </View>
      ) : (
        products.map((product) => (
          <View key={product.id} style={styles.productCard}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
            ) : null}
            <View style={styles.productBody}>
              <Text style={styles.productCategory}>{product.category}</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productDescription}>
                {product.description || "Sem descricao informada."}
              </Text>
              <Text style={styles.productPrice}>R$ {product.price.toFixed(2)}</Text>
            </View>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  storeCard: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  storeName: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  storeAddress: {
    color: mobileTheme.colors.textMuted
  },
  searchCard: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: 18,
    gap: 10,
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
  searchHelper: {
    color: mobileTheme.colors.textSoft
  },
  productCard: {
    backgroundColor: mobileTheme.colors.surface,
    borderRadius: mobileTheme.radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  productImage: {
    width: "100%",
    height: 180,
    backgroundColor: mobileTheme.colors.surfaceStrong
  },
  productBody: {
    padding: 18,
    gap: 8
  },
  productCategory: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1.1
  },
  productName: {
    color: mobileTheme.colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  productDescription: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 20
  },
  productPrice: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800",
    fontSize: 17
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
