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
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { ordersService } from "../features/orders/orders-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
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
        setError("Sua sessao expirou. Entre novamente para ver os pedidos disponiveis.");
        await logout();
        return;
      }

      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar os pedidos disponiveis."
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
        setError("Sua sessao expirou. Entre novamente para continuar.");
        await logout();
        return;
      }

      setError(
        acceptError instanceof ApiError
          ? acceptError.message
          : "Nao foi possivel aceitar o pedido."
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
            ? "Veja apenas pedidos das empresas onde seu vinculo ja foi aprovado, com atualizacao em tempo real."
            : "Veja apenas pedidos das empresas onde seu vinculo ja foi aprovado."
        }
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
                void loadOrders();
              }}
              refreshing={refreshing}
            />
          }
          contentContainerStyle={styles.content}
        >
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!error && orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Nenhum pedido disponivel no momento para as empresas em que voce foi aprovado.
              </Text>
            </View>
          ) : null}

          {orders.length > 0 ? (
            <>
              {orders.map((order) => (
                <OrderCard
                  actionLabel={actingOrderId === order.id ? "Aceitando..." : "Aceitar pedido"}
                  disabled={actingOrderId === order.id}
                  key={order.id}
                  onAction={() => void handleAccept(order.id)}
                  order={order}
                />
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
                  Pagina {page} de {totalPages}
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
                  <Text style={styles.pageButtonText}>Proxima</Text>
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
  errorText: {
    color: "#a82929",
    backgroundColor: "#fff1f1",
    padding: 12,
    borderRadius: 12
  },
  successText: {
    color: "#227044",
    backgroundColor: "#eef9f0",
    padding: 12,
    borderRadius: 12
  },
  emptyBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#fffaf0"
  },
  emptyText: {
    textAlign: "center",
    color: "#52606d"
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
    borderRadius: 12,
    backgroundColor: "#efe1ca"
  },
  pageButtonText: {
    color: "#8a5a00",
    fontWeight: "700"
  },
  pageText: {
    color: "#52606d"
  }
});
