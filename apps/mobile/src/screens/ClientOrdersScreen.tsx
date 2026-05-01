import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

function formatPaymentProofStatus(status?: Order["paymentProofStatus"]) {
  if (status === "SUBMITTED") {
    return "Comprovante enviado para conferência";
  }

  if (status === "APPROVED") {
    return "Aprovado pela loja";
  }

  if (status === "REJECTED") {
    return "Recusado pela loja";
  }

  return "Comprovante ainda não enviado";
}

interface PaymentProofDraft {
  payerName: string;
  amount: string;
  reference: string;
  notes: string;
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
  const [proofDrafts, setProofDrafts] = useState<Record<string, PaymentProofDraft>>({});
  const [proofSubmittingOrderId, setProofSubmittingOrderId] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

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

  function getProofDraft(orderId: string): PaymentProofDraft {
    return proofDrafts[orderId] ?? {
      payerName: "",
      amount: "",
      reference: "",
      notes: ""
    };
  }

  function updateProofDraft(orderId: string, patch: Partial<PaymentProofDraft>) {
    setProofDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {
          payerName: "",
          amount: "",
          reference: "",
          notes: ""
        }),
        ...patch
      }
    }));
  }

  async function submitPaymentProof(order: Order) {
    if (!token) {
      return;
    }

    const draft = getProofDraft(order.id);
    const payerName = draft.payerName.trim();
    const reference = draft.reference.trim();
    const amount = draft.amount.trim()
      ? Number(draft.amount.replace(",", "."))
      : undefined;

    if (!payerName && !reference) {
      setProofError("Informe o nome de quem pagou ou a referência do pagamento.");
      return;
    }

    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setProofError("Informe um valor pago válido.");
      return;
    }

    setProofSubmittingOrderId(order.id);
    setProofError(null);

    try {
      const updatedOrder = await ordersService.submitPaymentProof(token, order.id, {
        payerName: payerName || undefined,
        amount,
        reference: reference || undefined,
        notes: draft.notes.trim() || undefined
      });
      setOrders((current) =>
        current.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry))
      );
      setProofDrafts((current) => ({
        ...current,
        [order.id]: {
          payerName: "",
          amount: "",
          reference: "",
          notes: ""
        }
      }));
    } catch (submitError) {
      setProofError(
        submitError instanceof ApiError
          ? submitError.message
          : "Nao foi possivel enviar o comprovante."
      );
    } finally {
      setProofSubmittingOrderId(null);
    }
  }

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
                    Status do comprovante: {formatPaymentProofStatus(order.paymentProofStatus)}
                  </Text>
                  {order.paymentProofSubmittedAt ? (
                    <Text style={styles.pixMeta}>
                      Enviado em:{" "}
                      {new Date(order.paymentProofSubmittedAt).toLocaleString("pt-BR")}
                    </Text>
                  ) : null}
                  {order.paymentProofPayerName ? (
                    <Text style={styles.pixMeta}>
                      Pagador: {order.paymentProofPayerName}
                    </Text>
                  ) : null}
                  {order.paymentProofReference ? (
                    <Text style={styles.pixMeta}>
                      Referência: {order.paymentProofReference}
                    </Text>
                  ) : null}
                  <Text style={styles.pixMeta}>
                    O pagamento continua pendente até a loja confirmar manualmente.
                  </Text>
                  {order.paymentStatus === "PENDING" &&
                  order.paymentProofStatus !== "SUBMITTED" &&
                  order.paymentProofStatus !== "APPROVED" ? (
                    <View style={styles.proofForm}>
                      <Text style={styles.pixTitle}>Enviar referência do pagamento</Text>
                      <TextInput
                        onChangeText={(value) =>
                          updateProofDraft(order.id, { payerName: value })
                        }
                        placeholder="Nome de quem pagou"
                        placeholderTextColor={mobileTheme.colors.textSoft}
                        style={styles.input}
                        value={getProofDraft(order.id).payerName}
                      />
                      <TextInput
                        keyboardType="decimal-pad"
                        onChangeText={(value) =>
                          updateProofDraft(order.id, { amount: value })
                        }
                        placeholder="Valor pago"
                        placeholderTextColor={mobileTheme.colors.textSoft}
                        style={styles.input}
                        value={getProofDraft(order.id).amount}
                      />
                      <TextInput
                        onChangeText={(value) =>
                          updateProofDraft(order.id, { reference: value })
                        }
                        placeholder="Código/referência do pagamento"
                        placeholderTextColor={mobileTheme.colors.textSoft}
                        style={styles.input}
                        value={getProofDraft(order.id).reference}
                      />
                      <TextInput
                        multiline
                        onChangeText={(value) =>
                          updateProofDraft(order.id, { notes: value })
                        }
                        placeholder="Observações"
                        placeholderTextColor={mobileTheme.colors.textSoft}
                        style={styles.textArea}
                        value={getProofDraft(order.id).notes}
                      />
                      {proofError ? <Text style={styles.errorText}>{proofError}</Text> : null}
                      <Pressable
                        disabled={proofSubmittingOrderId === order.id}
                        onPress={() => void submitPaymentProof(order)}
                        style={styles.proofButton}
                      >
                        <Text style={styles.proofButtonText}>
                          {proofSubmittingOrderId === order.id
                            ? "Enviando..."
                            : "Enviar comprovante"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
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
  proofForm: {
    gap: 10,
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surface,
    color: mobileTheme.colors.text
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surface,
    color: mobileTheme.colors.text
  },
  proofButton: {
    alignItems: "center",
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 12
  },
  proofButtonText: {
    color: "#ffffff",
    fontWeight: "800"
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
