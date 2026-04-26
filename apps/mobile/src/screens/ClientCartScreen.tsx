import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../features/auth/auth-context";
import { useCart } from "../features/cart/cart-context";
import { ordersService } from "../features/orders/orders-service";
import { ApiError } from "../lib/http";
import { mobileShadow, mobileTheme } from "../theme";

export function ClientCartScreen() {
  const { token, user } = useAuth();
  const {
    groups,
    itemCount,
    total,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart
  } = useCart();
  const [fulfillmentType, setFulfillmentType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Sessao nao encontrada. Entre novamente para finalizar o pedido.");
      return;
    }

    if (groups.length === 0) {
      setError("Adicione pelo menos um produto ao carrinho.");
      return;
    }

    if (
      fulfillmentType === "DELIVERY" &&
      (!street.trim() || !number.trim() || !district.trim() || !city.trim())
    ) {
      setError("Informe rua, numero, bairro e cidade para entrega.");
      return;
    }

    setSubmitting(true);

    try {
      for (const group of groups) {
        await ordersService.createClient(token, {
          storeId: group.store.id,
          fulfillmentType,
          customerAddress:
            fulfillmentType === "PICKUP"
              ? "Retirada na loja"
              : [street.trim(), number.trim(), district.trim(), city.trim()]
                  .filter(Boolean)
                  .join(", "),
          addressStreet: street.trim() || undefined,
          addressNumber: number.trim() || undefined,
          addressDistrict: district.trim() || undefined,
          addressComplement: complement.trim() || undefined,
          addressCity: city.trim() || undefined,
          addressReference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          items: group.items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        });
      }

      clearCart();
      setStreet("");
      setNumber("");
      setDistrict("");
      setCity("");
      setComplement("");
      setReference("");
      setNotes("");
      setSuccess(
        groups.length > 1
          ? "Pedidos enviados para as empresas."
          : "Pedido enviado para a empresa."
      );
    } catch (checkoutError) {
      setError(
        checkoutError instanceof ApiError
          ? checkoutError.message
          : "Nao foi possivel finalizar o pedido."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <SectionHeader
        title="Carrinho"
        description="Revise os produtos e envie o pedido para as empresas."
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {user ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{user.name}</Text>
            <Text style={styles.summaryText}>{user.phone}</Text>
            <Text style={styles.summaryText}>
              {itemCount} item(ns) - R$ {total.toFixed(2)}
            </Text>
          </View>
        ) : null}

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Seu carrinho esta vazio. Escolha uma empresa e adicione produtos.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.store.id} style={styles.groupCard}>
              <Text style={styles.storeName}>{group.store.name}</Text>
              <Text style={styles.storeSubtotal}>
                Subtotal: R$ {group.subtotal.toFixed(2)}
              </Text>

              {group.items.map((item) => (
                <View key={item.product.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemPrice}>
                      R$ {item.product.price.toFixed(2)} cada
                    </Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <Pressable
                      onPress={() => decrementItem(item.product.id)}
                      style={styles.quantityButton}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </Pressable>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => incrementItem(item.product.id)}
                      style={styles.quantityButton}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={() => removeItem(item.product.id)}>
                    <Text style={styles.removeText}>Remover</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.checkoutCard}>
          <Text style={styles.label}>Forma de recebimento</Text>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => setFulfillmentType("DELIVERY")}
              style={[
                styles.segment,
                fulfillmentType === "DELIVERY" ? styles.segmentActive : undefined
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  fulfillmentType === "DELIVERY" ? styles.segmentTextActive : undefined
                ]}
              >
                Entrega
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFulfillmentType("PICKUP")}
              style={[
                styles.segment,
                fulfillmentType === "PICKUP" ? styles.segmentActive : undefined
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  fulfillmentType === "PICKUP" ? styles.segmentTextActive : undefined
                ]}
              >
                Retirada
              </Text>
            </Pressable>
          </View>

          {fulfillmentType === "DELIVERY" ? (
            <View style={styles.addressGrid}>
              <TextInput
                onChangeText={setStreet}
                placeholder="Rua"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={street}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={setNumber}
                placeholder="Numero"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={number}
              />
              <TextInput
                onChangeText={setDistrict}
                placeholder="Bairro"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={district}
              />
              <TextInput
                onChangeText={setCity}
                placeholder="Cidade"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={city}
              />
              <TextInput
                onChangeText={setComplement}
                placeholder="Complemento"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={complement}
              />
              <TextInput
                onChangeText={setReference}
                placeholder="Referencia"
                placeholderTextColor={mobileTheme.colors.textSoft}
                style={styles.input}
                value={reference}
              />
            </View>
          ) : (
            <View style={styles.pickupBox}>
              <Text style={styles.pickupText}>
                A empresa prepara o pedido para retirada. Nao ha taxa de entrega.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Observacoes</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Opcional"
            placeholderTextColor={mobileTheme.colors.textSoft}
            style={styles.textArea}
            value={notes}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total dos produtos</Text>
            <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
          </View>
          <Text style={styles.feeText}>
            {fulfillmentType === "DELIVERY"
              ? "A taxa de entrega sera informada pela empresa ao confirmar o pedido."
              : "Retirada na loja nao cobra taxa de entrega."}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <Pressable
            disabled={submitting || groups.length === 0}
            onPress={() => void handleCheckout()}
            style={({ pressed }) => [
              styles.checkoutButton,
              pressed ? styles.buttonPressed : undefined,
              submitting || groups.length === 0 ? styles.buttonDisabled : undefined
            ]}
          >
            <Text style={styles.checkoutButtonText}>
              {submitting ? "Enviando..." : "Finalizar pedido"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingTop: 16
  },
  summaryCard: {
    gap: 6,
    padding: 16,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong
  },
  summaryTitle: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    fontSize: 17
  },
  summaryText: {
    color: mobileTheme.colors.textMuted
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
    textAlign: "center",
    lineHeight: 21
  },
  groupCard: {
    gap: 14,
    padding: 18,
    borderRadius: mobileTheme.radii.lg,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  storeName: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  storeSubtotal: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "800"
  },
  itemRow: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: mobileTheme.colors.border
  },
  itemInfo: {
    gap: 4
  },
  itemName: {
    color: mobileTheme.colors.text,
    fontWeight: "800"
  },
  itemPrice: {
    color: mobileTheme.colors.textMuted
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileTheme.colors.primarySoft
  },
  quantityButtonText: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "900",
    fontSize: 18
  },
  quantityText: {
    color: mobileTheme.colors.text,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center"
  },
  removeText: {
    color: mobileTheme.colors.danger,
    fontWeight: "800"
  },
  checkoutCard: {
    gap: 12,
    padding: 18,
    borderRadius: mobileTheme.radii.lg,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    ...mobileShadow
  },
  label: {
    color: mobileTheme.colors.text,
    fontWeight: "800"
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    color: mobileTheme.colors.text
  },
  input: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderStrong,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    color: mobileTheme.colors.text
  },
  addressGrid: {
    gap: 10
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
  pickupBox: {
    padding: 14,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.successSoft
  },
  pickupText: {
    color: mobileTheme.colors.success,
    lineHeight: 20
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  totalLabel: {
    color: mobileTheme.colors.text,
    fontWeight: "800"
  },
  totalValue: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "900",
    fontSize: 18
  },
  feeText: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 20
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
  checkoutButton: {
    alignItems: "center",
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.primaryStrong,
    paddingVertical: 14
  },
  checkoutButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }]
  },
  buttonDisabled: {
    opacity: 0.6
  }
});
