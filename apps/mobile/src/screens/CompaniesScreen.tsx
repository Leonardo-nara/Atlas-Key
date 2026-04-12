import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { companyLinksService } from "../features/company-links/company-links-service";
import { ApiError } from "../lib/http";
import type { StoreCourierLink, StoreDiscoveryItem } from "../types/api";

function formatStatus(status: StoreCourierLink["status"]) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "APPROVED":
      return "Aprovado";
    case "REJECTED":
      return "Rejeitado";
    case "BLOCKED":
      return "Bloqueado";
    default:
      return status;
  }
}

function buildActionLabel(store: StoreDiscoveryItem) {
  switch (store.link?.status) {
    case "PENDING":
      return "Solicitacao pendente";
    case "APPROVED":
      return "Ja vinculado";
    case "BLOCKED":
      return "Acesso bloqueado";
    case "REJECTED":
      return "Solicitar novamente";
    default:
      return "Solicitar participacao";
  }
}

export function CompaniesScreen() {
  const { token } = useAuth();
  const [stores, setStores] = useState<StoreDiscoveryItem[]>([]);
  const [links, setLinks] = useState<StoreCourierLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingStoreId, setActingStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sortedLinks = useMemo(
    () =>
      [...links].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [links]
  );

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setError(null);
      const [nextStores, nextLinks] = await Promise.all([
        companyLinksService.listAvailableStores(token),
        companyLinksService.listMyLinks(token)
      ]);
      setStores(nextStores);
      setLinks(nextLinks);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar as empresas disponiveis."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [successMessage]);

  async function handleRequest(storeId: string) {
    if (!token) {
      return;
    }

    setActingStoreId(storeId);
    setError(null);

    try {
      await companyLinksService.requestJoin(token, storeId);
      setSuccessMessage("Solicitacao enviada para a empresa.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Nao foi possivel enviar sua solicitacao."
      );
    } finally {
      setActingStoreId(null);
    }
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Empresas"
        description="Solicite participacao em empresas e acompanhe o andamento dos seus vinculos."
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#b65b1c" size="large" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                void loadData();
              }}
              refreshing={refreshing}
            />
          }
          contentContainerStyle={styles.content}
        >
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Empresas disponiveis</Text>
            <Text style={styles.cardDescription}>
              Veja as empresas ativas e solicite entrada para operar nelas.
            </Text>

            {stores.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Nenhuma empresa ativa encontrada no momento.
                </Text>
              </View>
            ) : (
              stores.map((store) => {
                const disabled =
                  actingStoreId === store.id ||
                  store.link?.status === "PENDING" ||
                  store.link?.status === "APPROVED" ||
                  store.link?.status === "BLOCKED";

                return (
                  <View key={store.id} style={styles.storeCard}>
                    <View style={styles.storeHeader}>
                      <View style={styles.storeHeaderText}>
                        <Text style={styles.storeName}>{store.name}</Text>
                        <Text style={styles.storeAddress}>{store.address}</Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>
                          {store.link ? formatStatus(store.link.status) : "Sem vinculo"}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      disabled={disabled}
                      onPress={() => void handleRequest(store.id)}
                      style={[
                        styles.primaryButton,
                        disabled ? styles.disabledButton : undefined
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {actingStoreId === store.id
                          ? "Enviando..."
                          : buildActionLabel(store)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Minhas solicitacoes e vinculos</Text>
            <Text style={styles.cardDescription}>
              Acompanhe o que esta pendente e quais empresas ja aprovaram seu cadastro.
            </Text>

            {sortedLinks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Voce ainda nao possui solicitacoes nem vinculos registrados.
                </Text>
              </View>
            ) : (
              sortedLinks.map((link) => (
                <View key={link.id} style={styles.linkCard}>
                  <View style={styles.storeHeader}>
                    <View style={styles.storeHeaderText}>
                      <Text style={styles.storeName}>{link.store.name}</Text>
                      <Text style={styles.storeAddress}>{link.store.address}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{formatStatus(link.status)}</Text>
                    </View>
                  </View>

                  <Text style={styles.linkMeta}>
                    Solicitado em {new Date(link.createdAt).toLocaleString("pt-BR")}
                  </Text>
                  {link.approvedAt ? (
                    <Text style={styles.linkMeta}>
                      Aprovado em {new Date(link.approvedAt).toLocaleString("pt-BR")}
                    </Text>
                  ) : null}
                  {link.rejectedAt ? (
                    <Text style={styles.linkMeta}>
                      Rejeitado em {new Date(link.rejectedAt).toLocaleString("pt-BR")}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  content: {
    paddingTop: 16,
    gap: 16
  },
  card: {
    backgroundColor: "#fffaf0",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#ead8b2"
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2933"
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#52606d"
  },
  storeCard: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f5efe2"
  },
  linkCard: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#f5efe2"
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  storeHeaderText: {
    flex: 1,
    gap: 4
  },
  storeName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2933"
  },
  storeAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: "#52606d"
  },
  statusBadge: {
    backgroundColor: "#efe1ca",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  statusText: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  primaryButton: {
    backgroundColor: "#b65b1c",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center"
  },
  disabledButton: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: "#fffaf0",
    fontWeight: "700"
  },
  linkMeta: {
    fontSize: 13,
    color: "#52606d"
  },
  successText: {
    backgroundColor: "#e7f8ee",
    color: "#166534",
    padding: 12,
    borderRadius: 14
  },
  errorText: {
    backgroundColor: "#fde8e8",
    color: "#b42318",
    padding: 12,
    borderRadius: 14
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: "#ead8b2",
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fffdf8"
  },
  emptyText: {
    color: "#52606d",
    lineHeight: 21
  }
});
