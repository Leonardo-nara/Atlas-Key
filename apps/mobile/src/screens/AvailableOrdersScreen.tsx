import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  SectionTitle,
  courierTheme
} from "../components/courier-ui";
import { useAuth } from "../features/auth/auth-context";
import { ordersService } from "../features/orders/orders-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
import { useTabContentBottomPadding } from "../navigation/useTabContentBottomPadding";
import type { Order } from "../types/api";

export function AvailableOrdersScreen() {
  const { logout, token, user } = useAuth();
  const { isConnected, subscribeToOrderEvents } = useRealtime();
  const bottomPadding = useTabContentBottomPadding();
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
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
        setError("Sua sessão expirou. Entre novamente para ver as entregas disponíveis.");
        await logout();
        return;
      }

      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Não foi possível carregar as entregas disponíveis."
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

    return subscribeToOrderEvents((payload) => {
      if (payload.event === "orders.created") {
        setNewOrderIds((current) => [
          payload.order.id,
          ...current.filter((orderId) => orderId !== payload.order.id)
        ].slice(0, 8));
        setSuccessMessage("Nova entrega disponível para você.");
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

  function confirmAccept(orderId: string) {
    Alert.alert(
      "Aceitar entrega?",
      "Você vai assumir este pedido e a empresa será avisada.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceitar entrega",
          onPress: () => void handleAccept(orderId)
        }
      ]
    );
  }

  async function handleAccept(orderId: string) {
    if (!token) {
      return;
    }

    setActingOrderId(orderId);
    setError(null);

    try {
      await ordersService.accept(token, orderId);
      setSuccessMessage("Entrega aceita com sucesso.");
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
          : "Não foi possível aceitar a entrega."
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
            ? "Entregas liberadas pelas empresas vinculadas aparecem em tempo real."
            : "Puxe para atualizar enquanto o tempo real estiver indisponível."
        }
        title={`Olá, ${user?.name?.split(" ")[0] ?? "motoboy"}`}
      />

      <View style={styles.metricsRow}>
        <MetricCard
          detail={isConnected ? "tempo real ativo" : "atualização manual"}
          label="Disponíveis"
          value={`${orders.length}`}
        />
        <MetricCard label="Página" value={`${page}/${totalPages}`} />
      </View>

      {loading ? (
        <CourierState
          description="Buscando entregas confirmadas pelas lojas vinculadas."
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
          {error ? <FeedbackBanner message={error} tone="danger" /> : null}

          {!error && orders.length === 0 ? (
            <CourierState
              description="Mantenha o app aberto. Quando uma loja confirmar um pedido para entrega, ele aparece aqui."
              title="Nenhuma entrega disponível agora."
            />
          ) : null}

          {orders.length > 0 ? (
            <>
              <SectionTitle
                description="Confira rota, total, pagamento e cliente antes de assumir."
                title="Fila de entregas"
              />

              {orders.map((order) => (
                <View key={order.id} style={styles.orderStack}>
                  <CourierDeliveryCard
                    actionLabel={
                      actingOrderId === order.id ? "Aceitando..." : "Aceitar entrega"
                    }
                    actionTestID="courier-accept-order"
                    disabled={actingOrderId === order.id}
                    highlighted={newOrderIds.includes(order.id)}
                    onAction={() => confirmAccept(order.id)}
                    order={order}
                    testID="courier-available-order-card"
                  />
                  <CourierProgressTimeline order={order} />
                </View>
              ))}

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
          ) : null}
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
    flexWrap: "wrap",
    gap: 12
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
