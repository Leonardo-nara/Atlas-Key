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
import { getFulfillmentText, getOrderStatusText } from "../features/orders/order-display";
import { ordersService } from "../features/orders/orders-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
import { mobileTheme } from "../theme";
import type { Order, StorePixKeyType } from "../types/api";

function formatPixKeyType(type: StorePixKeyType) {
  if (type === "RANDOM_KEY") {
    return "Chave aleatoria";
  }

  if (type === "PHONE") {
    return "Telefone";
  }

  if (type === "EMAIL") {
    return "E-mail";
  }

  return type;
}

export function ClientOrdersScreen() {
  const { token } = useAuth();
  const { isConnected, subscribeToOrderEvents } = useRealtime();
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setError(null);
      const response = await ordersService.clientMine(token, page, 8);
      setOrders(response.items);
      setTotalPages(response.meta.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar seus pedidos."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, token]);

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

  return (
    <ScreenContainer>
      <SectionHeader
        title="Meus pedidos"
        description={
          isConnected
            ? "Acompanhe status, taxa e total com atualizacao em tempo real."
            : "Acompanhe os pedidos enviados para as empresas."
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
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!error && orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Voce ainda nao fez pedidos. Escolha uma empresa e adicione produtos ao carrinho.
              </Text>
            </View>
          ) : null}

          {orders.map((order) => (
            <View key={order.id} style={styles.clientOrderCard}>
              <OrderCard audience="client" order={order} />
              <View style={styles.statusBox}>
                <Text style={styles.statusTitle}>{getOrderStatusText(order, "client")}</Text>
                <Text style={styles.statusText}>
                  {getFulfillmentText(order)} - Total atual R$ {order.total.toFixed(2)}
                </Text>
              </View>
              {order.paymentMethod === "PIX_MANUAL" ? (
                <View style={styles.pixBox}>
                  <Text style={styles.pixTitle}>Pix manual</Text>
                  {order.pixPaymentInstructions ? (
                    <>
                      <Text style={styles.pixText}>
                        {formatPixKeyType(order.pixPaymentInstructions.pixKeyType)}:{" "}
                        {order.pixPaymentInstructions.pixKey}
                      </Text>
                      <Text style={styles.pixText}>
                        Recebedor: {order.pixPaymentInstructions.pixRecipientName}
                      </Text>
                      <Text style={styles.pixMeta}>
                        {order.pixPaymentInstructions.pixInstructions}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.pixMeta}>
                      A loja ainda nao informou uma chave Pix ativa. Aguarde a orientacao
                      da empresa.
                    </Text>
                  )}
                  <Text style={styles.pixMeta}>
                    O pagamento continua pendente até a loja confirmar manualmente.
                  </Text>
                </View>
              ) : null}
              <OrderTimeline audience="client" order={order} />
            </View>
          ))}

          {orders.length > 0 ? (
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
    color: mobileTheme.colors.danger,
    backgroundColor: mobileTheme.colors.dangerSoft,
    padding: 12,
    borderRadius: mobileTheme.radii.sm
  },
  emptyBox: {
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
  clientOrderCard: {
    gap: 10
  },
  statusBox: {
    padding: 14,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  statusTitle: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800",
    marginBottom: 4
  },
  statusText: {
    color: mobileTheme.colors.textMuted
  },
  pixBox: {
    padding: 14,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.warningSoft,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  pixTitle: {
    color: mobileTheme.colors.warning,
    fontWeight: "900",
    marginBottom: 6
  },
  pixText: {
    color: mobileTheme.colors.text,
    fontWeight: "700",
    marginBottom: 4
  },
  pixMeta: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 20
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
