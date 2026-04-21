import { Pressable, StyleSheet, Text, View } from "react-native";

import { mobileShadow, mobileTheme } from "../theme";
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

function getStatusVariant(label: string) {
  if (label === "Entregue") {
    return {
      container: styles.badgeSuccess,
      text: styles.badgeTextSuccess
    };
  }

  if (label === "Cancelado") {
    return {
      container: styles.badgeDanger,
      text: styles.badgeTextDanger
    };
  }

  if (label === "Em entrega") {
    return {
      container: styles.badgePrimary,
      text: styles.badgeTextPrimary
    };
  }

  return {
    container: styles.badgeWarning,
    text: styles.badgeTextWarning
  };
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
  const statusLabel = formatOrderStatus(order);
  const statusVariant = getStatusVariant(statusLabel);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.customer}>{order.customerName}</Text>
          <Text style={styles.meta}>{order.customerPhone}</Text>
        </View>
        <View style={[styles.badge, statusVariant.container]}>
          <Text style={[styles.badgeText, statusVariant.text]}>{statusLabel}</Text>
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
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    gap: 14,
    ...mobileShadow
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  customer: {
    fontSize: 18,
    fontWeight: "800",
    color: mobileTheme.colors.text
  },
  meta: {
    color: mobileTheme.colors.textMuted,
    fontSize: 14
  },
  storeBlock: {
    gap: 6,
    padding: 12,
    borderRadius: mobileTheme.radii.sm,
    backgroundColor: mobileTheme.colors.surfaceMuted
  },
  store: {
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "700"
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
    color: mobileTheme.colors.text,
    fontWeight: "800"
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileTheme.radii.pill
  },
  badgeWarning: {
    backgroundColor: mobileTheme.colors.warningSoft
  },
  badgePrimary: {
    backgroundColor: mobileTheme.colors.primarySoft
  },
  badgeSuccess: {
    backgroundColor: mobileTheme.colors.successSoft
  },
  badgeDanger: {
    backgroundColor: mobileTheme.colors.dangerSoft
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  badgeTextWarning: {
    color: mobileTheme.colors.warning
  },
  badgeTextPrimary: {
    color: mobileTheme.colors.primaryStrong
  },
  badgeTextSuccess: {
    color: mobileTheme.colors.success
  },
  badgeTextDanger: {
    color: mobileTheme.colors.danger
  },
  action: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: mobileTheme.radii.sm,
    alignItems: "center",
    backgroundColor: mobileTheme.colors.primaryStrong
  },
  actionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }]
  },
  actionDisabled: {
    opacity: 0.55
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "800"
  }
});
