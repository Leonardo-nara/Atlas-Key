import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Order } from "../types/api";

function formatOrderStatus(order: Order) {
  const status = order.statusLabel ?? order.status.toLowerCase();

  switch (status) {
    case "pending":
      return "Pendente";
    case "accepted":
      return "Aceito";
    case "picked_up":
      return "Em entrega";
    case "delivered":
      return "Entregue";
    case "cancelled":
      return "Cancelado";
    default:
      return order.statusLabel ?? order.status;
  }
}

export function OrderCard({
  order,
  actionLabel,
  onAction,
  disabled
}: {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.customer}>{order.customerName}</Text>
          <Text style={styles.meta}>{order.customerPhone}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatOrderStatus(order)}</Text>
        </View>
      </View>

      <Text style={styles.meta}>{order.customerAddress}</Text>

      <View style={styles.storeBlock}>
        <Text style={styles.store}>
          Empresa: {order.store?.name ?? "Empresa nao informada"}
        </Text>
        {order.store?.address ? (
          <Text style={styles.meta}>Origem: {order.store.address}</Text>
        ) : null}
      </View>

      <View style={styles.list}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <Text style={styles.meta}>
              {item.quantity}x {item.nameSnapshot}
            </Text>
            <Text style={styles.total}>R$ {item.totalPrice.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.line}>
        <Text style={styles.meta}>Total</Text>
        <Text style={styles.total}>R$ {order.total.toFixed(2)}</Text>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          disabled={disabled}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && !disabled ? styles.actionPressed : undefined,
            disabled ? styles.actionDisabled : undefined
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#ead8b2",
    gap: 12
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  customer: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2933"
  },
  meta: {
    color: "#52606d",
    fontSize: 14
  },
  storeBlock: {
    gap: 4
  },
  store: {
    color: "#8a5a00",
    fontWeight: "600"
  },
  list: {
    gap: 8
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  total: {
    color: "#1f2933",
    fontWeight: "700"
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3e0bf"
  },
  badgeText: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  action: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#b65b1c"
  },
  actionPressed: {
    opacity: 0.85
  },
  actionDisabled: {
    opacity: 0.55
  },
  actionText: {
    color: "#fffaf0",
    fontWeight: "700"
  }
});
