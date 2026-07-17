import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { CourierDeliveryCard } from "../components/CourierDeliveryCard";
import {
  CourierButton,
  CourierHeader,
  CourierProgressTimeline,
  CourierScreen,
  CourierState,
  FeedbackBanner,
  MetricCard,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";
import { ordersService } from "../features/orders/orders-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
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
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);

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
          : "Não foi possível carregar suas entregas."
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

    return subscribeToOrderEvents((payload) => {
      if (
        payload.event === "orders.accepted" ||
        payload.event === "orders.status_updated" ||
        payload.event === "orders.cancelled"
      ) {
        setRealtimeMessage("Entregas atualizadas com o status mais recente.");
      }

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

  useEffect(() => {
    if (!realtimeMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setRealtimeMessage(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [realtimeMessage]);

  function confirmStatusUpdate(orderId: string, status: "picked_up" | "delivered") {
    Alert.alert(
      "Atualizar entrega?",
      status === "picked_up"
        ? "Confirme que o pedido foi coletado e saiu para entrega."
        : "Confirme somente após finalizar a entrega ao cliente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => void handleStatusUpdate(orderId, status)
        }
      ]
    );
  }

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
          ? "Entrega marcada como coletada."
          : "Entrega marcada como entregue."
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
    <CourierScreen>
      <CourierHeader
        description={
          isConnected
            ? "Acompanhe suas entregas com atualização em tempo real."
            : "Puxe para atualizar suas entregas quando precisar."
        }
        title="Minhas entregas"
      />

      <View style={styles.metricsRow}>
        <MetricCard
          detail={scope === "active" ? "em rota ou aceitas" : "histórico"}
          label="Entregas"
          value={`${orders.length}`}
        />
        <MetricCard label="Página" value={`${page}/${totalPages}`} />
      </View>

      <View style={styles.segmented}>
        <Pressable
          onPress={() => {
            setPage(1);
            setScope("active");
          }}
          style={[styles.segment, scope === "active" ? styles.segmentActive : undefined]}
        >
          <Text
            style={[
              styles.segmentText,
              scope === "active" ? styles.segmentTextActive : undefined
            ]}
          >
            Ativas
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
            Concluídas
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <CourierState
          description="Atualizando sua lista operacional."
          loading
          title="Carregando entregas..."
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                void loadOrders();
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
          {realtimeMessage ? <FeedbackBanner message={realtimeMessage} /> : null}
          {error ? <FeedbackBanner message={error} tone="danger" /> : null}

          {orders.length === 0 ? (
            <CourierState
              description={
                scope === "active"
                  ? "Entregas aceitas ou em rota aparecerão nesta lista."
                  : "Entregas finalizadas ficam disponíveis para consulta."
              }
              title={
                scope === "active"
                  ? "Nenhuma entrega ativa agora."
                  : "Nenhuma entrega concluída ainda."
              }
            />
          ) : (
            <>
              {orders.map((order) => {
                const action = nextAction(order);

                return (
                  <View key={order.id} style={styles.orderStack}>
                    <CourierDeliveryCard
                      actionLabel={
                        actingOrderId === order.id
                          ? "Atualizando..."
                          : action?.label
                      }
                      disabled={!action || actingOrderId === order.id}
                      onAction={
                        action
                          ? () => confirmStatusUpdate(order.id, action.status)
                          : undefined
                      }
                      order={order}
                    />
                    <CourierProgressTimeline order={order} />
                  </View>
                );
              })}

              <View style={styles.pagination}>
                <CourierButton
                  disabled={page === 1}
                  label="Anterior"
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  variant="secondary"
                />
                <Text style={styles.pageText}>
                  Página {page} de {totalPages}
                </Text>
                <CourierButton
                  disabled={page >= totalPages}
                  label="Próxima"
                  onPress={() =>
                    setPage((current) =>
                      current < totalPages ? current + 1 : current
                    )
                  }
                  variant="secondary"
                />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </CourierScreen>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  segmented: {
    flexDirection: "row",
    gap: 6,
    padding: 5,
    borderRadius: 18,
    backgroundColor: courierTheme.colors.surface,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  segment: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 12
  },
  segmentActive: {
    backgroundColor: courierTheme.colors.primary
  },
  segmentText: {
    color: courierTheme.colors.textMuted,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#03111E"
  },
  content: {
    gap: 18
  },
  orderStack: {
    gap: 12
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  pageText: {
    color: courierTheme.colors.textMuted,
    fontWeight: "800"
  }
});
