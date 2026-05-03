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
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
import { mobileTheme } from "../theme";
import type { Order } from "../types/api";

function nextAction(order: Order) {
  const status = order.statusLabel ?? order.status.toLowerCase();

  if (status === "accepted") {
    return { label: "Marcar como coletado", status: "picked_up" as const };
  }

  if (status === "picked_up") {
    return { label: "Marcar como entregue", status: "delivered" as const };
  }

  return null;
}

export function MyOrdersScreen() {
  const { token } = useAuth();
  const { isConnected, subscribeToOrderEvents } = useRealtime();
  const bottomPadding = useTabContentBottomPadding();
  const [orders, setOrders] = useState<Order[]>([]);
  const [scope, setScope] = useState<"active" | "completed">("active");
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
      const response = await ordersService.mine(token, scope, page, 6);
      setOrders(response.items);
      setTotalPages(response.meta.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Não foi possível carregar seus pedidos."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, scope, token]);

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

  async function handleStatusUpdate(orderId: string, status: "picked_up" | "delivered") {
    if (!token) {
      return;
    }

    setActingOrderId(orderId);
    setError(null);

    try {
      await ordersService.updateStatus(token, orderId, status);
      setSuccessMessage(
        status === "picked_up"
          ? "Pedido marcado como coletado."
          : "Pedido marcado como entregue."
      );
      await loadOrders();
    } catch (statusError) {
      setError(
        statusError instanceof ApiError
          ? statusError.message
          : "Não foi possível atualizar o status."
      );
    } finally {
      setActingOrderId(null);
    }
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Meus pedidos"
        description={
          isConnected
            ? "Acompanhe entregas das empresas aprovadas no seu perfil com sincronização em tempo real."
            : "Acompanhe entregas das empresas em que você já está aprovado."
        }
      />

      <View style={styles.segmented}>
        <Pressable
          onPress={() => {
            setPage(1);
            setScope("active");
          }}
          style={[
            styles.segment,
            scope === "active" ? styles.segmentActive : undefined
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              scope === "active" ? styles.segmentTextActive : undefined
            ]}
          >
            Ativos
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setPage(1);
            setScope("completed");
          }}
          style={[
            styles.segment,
            scope === "completed" ? styles.segmentActive : undefined
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              scope === "completed" ? styles.segmentTextActive : undefined
            ]}
          >
            Concluídos
          </Text>
        </Pressable>
      </View>

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
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {scope === "active"
                  ? "Você ainda não tem pedidos ativos nas empresas em que está vinculado."
                  : "Nenhum pedido concluído por enquanto."}
              </Text>
            </View>
          ) : (
            <>
              {orders.map((order) => {
                const action = nextAction(order);

                return (
                  <View key={order.id} style={styles.orderStack}>
                    <OrderCard
                      actionLabel={
                        actingOrderId === order.id
                          ? "Atualizando..."
                          : action?.label
                      }
                      audience="courier"
                      disabled={!action || actingOrderId === order.id}
                      onAction={
                        action
                          ? () => void handleStatusUpdate(order.id, action.status)
                          : undefined
                      }
                      order={order}
                    />
                    <OrderTimeline audience="courier" order={order} />
                  </View>
                );
              })}

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
          )}
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
  segmented: {
    flexDirection: "row",
    backgroundColor: mobileTheme.colors.surfaceStrong,
    borderRadius: mobileTheme.radii.sm,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  segmentActive: {
    backgroundColor: mobileTheme.colors.primaryStrong
  },
  segmentText: {
    color: mobileTheme.colors.textMuted,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  content: {
    paddingTop: 16,
    gap: 16
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
    color: mobileTheme.colors.textMuted
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
