import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { OrderCard } from "../components/OrderCard";
import { OrderTimeline } from "../components/OrderTimeline";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { ordersService } from "../features/orders/orders-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
import { mobileTheme } from "../theme";
import type { Order } from "../types/api";

export function AvailableOrdersScreen() {
  const { logout, token } = useAuth();
  const { isConnected, subscribeToOrderEvents } = useRealtime();
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setError(null);
      const response = await ordersService.available(token, page, 6);
      setOrders(response.items);
      setTotalPages(response.meta.totalPages);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        setOrders([]);
        setTotalPages(1);
        setError("Sua sessão expirou. Entre novamente para ver os pedidos disponíveis.");
        await logout();
        return;
      }

      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Não foi possível carregar os pedidos disponíveis."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout, page, token]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!token) {
      return;
    }

    return subscribeToOrderEvents(() => {
      void loadOrders();
    });
  }, [loadOrders, subscribeToOrderEvents, token]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [successMessage]);

  async function handleAccept(orderId: string) {
    if (!token) {
      return;
    }

    setActingOrderId(orderId);
    setError(null);

    try {
      await ordersService.accept(token, orderId);
      setSuccessMessage("Pedido aceito com sucesso.");
      await loadOrders();
    } catch (acceptError) {
      if (acceptError instanceof ApiError && acceptError.status === 401) {
        setError("Sua sessão expirou. Entre novamente para continuar.");
        await logout();
        return;
      }

      setError(
        acceptError instanceof ApiError
          ? acceptError.message
          : "Não foi possível aceitar o pedido."
      );
    } finally {
      setActingOrderId(null);
    }
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Pedidos disponiveis"
        description={
          isConnected
            ? "Veja somente pedidos das empresas com vinculo aprovado, com atualizacao em tempo real."
            : "Veja somente pedidos das empresas com vinculo aprovado."
        }
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={mobileTheme.colors.primaryStrong} size="large" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                void loadOrders();
              }}
              refreshing={refreshing}
            />
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.connectionCard}>
            <Text style={styles.connectionTitle}>
              {isConnected ? "Tempo real ativo" : "Atualizacao manual"}
            </Text>
            <Text style={styles.connectionText}>
              {isConnected
                ? "Novos pedidos e mudanças entram automaticamente na lista."
                : "Puxe para atualizar enquanto a conexão em tempo real estiver indisponível."}
            </Text>
          </View>

          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!error && orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Nenhum pedido disponível no momento para as empresas em que você foi aprovado.
              </Text>
            </View>
          ) : null}

          {orders.length > 0 ? (
            <>
              {orders.map((order) => (
                <View key={order.id} style={styles.orderStack}>
                  <OrderCard
                    actionLabel={actingOrderId === order.id ? "Aceitando..." : "Aceitar pedido"}
                    audience="courier"
                    disabled={actingOrderId === order.id}
                    onAction={() => void handleAccept(order.id)}
                    order={order}
                  />
                  <OrderTimeline audience="courier" order={order} />
                </View>
              ))}

              <View style={styles.pagination}>
                <Pressable
                  disabled={page === 1}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  style={styles.pageButton}
                >
                  <Text style={styles.pageButtonText}>Anterior</Text>
                </Pressable>
                <Text style={styles.pageText}>
                  Página {page} de {totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages}
                  onPress={() =>
                    setPage((current) =>
                      current < totalPages ? current + 1 : current
                    )
                  }
                  style={styles.pageButton}
                >
                  <Text style={styles.pageButtonText}>Próxima</Text>
                </Pressable>
              </View>
            </>
          ) : null}
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
  connectionCard: {
    padding: 16,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  connectionTitle: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    marginBottom: 4
  },
  connectionText: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 21
  },
  errorText: {
    color: mobileTheme.colors.danger,
    backgroundColor: mobileTheme.colors.dangerSoft,
    padding: 12,
    borderRadius: mobileTheme.radii.sm
  },
  successText: {
    color: mobileTheme.colors.success,
    backgroundColor: mobileTheme.colors.successSoft,
    padding: 12,
    borderRadius: mobileTheme.radii.sm
  },
  emptyBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border
  },
  emptyText: {
    textAlign: "center",
    color: mobileTheme.colors.textMuted,
    lineHeight: 21
  },
  orderStack: {
    gap: 10
  },
  pagination: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pageButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.primarySoft
  },
  pageButtonText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800"
  },
  pageText: {
    color: mobileTheme.colors.textMuted
  }
});
