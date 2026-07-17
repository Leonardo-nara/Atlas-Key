import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  CourierButton,
  CourierCard,
  CourierHeader,
  CourierScreen,
  CourierState,
  FeedbackBanner,
  SectionTitle,
  StatusPill,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";
import { companyLinksService } from "../features/company-links/company-links-service";
import { ApiError } from "../lib/http";
import { toMediaUrl } from "../lib/media-url";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
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

function statusTone(status?: StoreCourierLink["status"]) {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED" || status === "BLOCKED") return "danger";
  return "info";
}

function buildActionLabel(store: StoreDiscoveryItem) {
  switch (store.link?.status) {
    case "PENDING":
      return "Solicitação pendente";
    case "APPROVED":
      return "Já vinculado";
    case "BLOCKED":
      return "Acesso bloqueado";
    case "REJECTED":
      return "Solicitar novamente";
    default:
      return "Solicitar participação";
  }
}

export function CompaniesScreen() {
  const { token } = useAuth();
  const bottomPadding = useTabContentBottomPadding();
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

  const approvedLinks = sortedLinks.filter((link) => link.status === "APPROVED");
  const pendingLinks = sortedLinks.filter((link) => link.status === "PENDING");

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
          : "Não foi possível carregar as empresas disponíveis."
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
      setSuccessMessage("Solicitação enviada para a empresa.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível enviar sua solicitação."
      );
    } finally {
      setActingStoreId(null);
    }
  }

  return (
    <CourierScreen>
      <CourierHeader
        description="Solicite participação, acompanhe análises e veja onde você já pode operar."
        title="Empresas"
      />

      <View style={styles.metricsRow}>
        <CourierCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Aprovadas</Text>
          <Text style={styles.metricValue}>{approvedLinks.length}</Text>
        </CourierCard>
        <CourierCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pendentes</Text>
          <Text style={styles.metricValue}>{pendingLinks.length}</Text>
        </CourierCard>
      </View>

      {loading ? (
        <CourierState
          description="Buscando empresas disponíveis e seus vínculos."
          loading
          title="Carregando empresas..."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                void loadData();
              }}
              refreshing={refreshing}
              tintColor={courierTheme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {successMessage ? (
            <FeedbackBanner message={successMessage} tone="success" />
          ) : null}
          {error ? <FeedbackBanner message={error} tone="danger" /> : null}

          <SectionTitle
            description="Empresas ativas para solicitação de vínculo."
            title="Disponíveis para operar"
          />

          {stores.length === 0 ? (
            <CourierState
              description="Quando uma loja estiver ativa para motoboys, ela aparecerá aqui."
              title="Nenhuma empresa ativa encontrada agora."
            />
          ) : (
            stores.map((store) => {
              const disabled =
                actingStoreId === store.id ||
                store.link?.status === "PENDING" ||
                store.link?.status === "APPROVED" ||
                store.link?.status === "BLOCKED";
              const imageUrl = store.imageUrl ? toMediaUrl(store.imageUrl) : null;

              return (
                <CourierCard key={store.id}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.storeImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imageInitial}>{store.name.slice(0, 1)}</Text>
                    </View>
                  )}

                  <View style={styles.storeHeader}>
                    <View style={styles.storeCopy}>
                      <Text style={styles.storeName}>{store.name}</Text>
                      <Text style={styles.storeAddress}>
                        {store.address || "Endereço não informado"}
                      </Text>
                    </View>
                    <StatusPill
                      label={store.link ? formatStatus(store.link.status) : "Sem vínculo"}
                      tone={statusTone(store.link?.status)}
                    />
                  </View>

                  <CourierButton
                    disabled={disabled}
                    label={
                      actingStoreId === store.id
                        ? "Enviando..."
                        : buildActionLabel(store)
                    }
                    onPress={() => void handleRequest(store.id)}
                  />
                </CourierCard>
              );
            })
          )}

          <SectionTitle
            description="Histórico das solicitações enviadas às empresas."
            title="Meus vínculos"
          />

          {sortedLinks.length === 0 ? (
            <CourierState
              description="Solicite participação em uma empresa para acompanhar seu vínculo."
              title="Nenhum vínculo registrado."
            />
          ) : (
            sortedLinks.map((link) => (
              <CourierCard key={link.id} style={styles.linkCard}>
                <View style={styles.storeHeader}>
                  <View style={styles.storeCopy}>
                    <Text style={styles.storeName}>{link.store.name}</Text>
                    <Text style={styles.storeAddress}>
                      {link.store.address || "Endereço não informado"}
                    </Text>
                  </View>
                  <StatusPill label={formatStatus(link.status)} tone={statusTone(link.status)} />
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
              </CourierCard>
            ))
          )}
        </ScrollView>
      )}
    </CourierScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12
  },
  metricCard: {
    flex: 1,
    padding: 14
  },
  metricLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metricValue: {
    color: courierTheme.colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  storeImage: {
    width: "100%",
    height: 132,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.surfaceElevated
  },
  imagePlaceholder: {
    height: 132,
    borderRadius: courierTheme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: courierTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  imageInitial: {
    color: courierTheme.colors.primary,
    fontSize: 36,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  storeCopy: {
    flex: 1,
    gap: 4
  },
  storeName: {
    color: courierTheme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  storeAddress: {
    color: courierTheme.colors.textMuted,
    lineHeight: 20
  },
  linkCard: {
    padding: 16
  },
  linkMeta: {
    color: courierTheme.colors.textMuted,
    fontSize: 13
  }
});
