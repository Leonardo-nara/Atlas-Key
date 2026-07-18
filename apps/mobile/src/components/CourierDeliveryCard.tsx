import { StyleSheet, Text, View } from "react-native";

import {
  getFulfillmentText,
  getOrderStatusText,
  type OrderTimelineAudience
} from "../features/orders/order-display";
import type { Order } from "../types/api";
import {
  CourierButton,
  CourierCard,
  StatusPill,
  courierTheme
} from "./courier-ui";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function formatPaymentMethod(method?: Order["paymentMethod"]) {
  if (method === "CARD_ON_DELIVERY") return "Cartão na entrega";
  if (method === "PIX_MANUAL") return "Pix manual";
  if (method === "ONLINE") return "Pix automático";
  return "Dinheiro";
}

function formatPaymentStatus(status?: Order["paymentStatus"]) {
  if (status === "PAID") return "Pago";
  if (status === "FAILED") return "Falhou";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "REFUNDED") return "Reembolsado";
  return "Pendente";
}

function getStatusTone(label: string): "info" | "success" | "warning" | "danger" | "muted" {
  if (label === "Entregue") return "success";
  if (label === "Cancelado") return "danger";
  if (label === "Disponível") return "info";
  if (label === "Saiu para entrega" || label === "Retirado para entrega") return "info";
  return "warning";
}

export function CourierDeliveryCard({
  order,
  actionLabel,
  onAction,
  disabled,
  highlighted,
  audience = "courier",
  testID,
  actionTestID
}: {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  audience?: OrderTimelineAudience;
  testID?: string;
  actionTestID?: string;
}) {
  const statusLabel = getOrderStatusText(order, audience);
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <CourierCard highlighted={highlighted} testID={testID}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.orderNumber}>Pedido #{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.storeName}>{order.store?.name ?? "Empresa não informada"}</Text>
        </View>
        <StatusPill label={highlighted ? "Novo" : statusLabel} tone={highlighted ? "info" : getStatusTone(statusLabel)} />
      </View>

      <View style={styles.routeBox}>
        <RouteLine label="Retirada" value={order.store?.address ?? "Endereço da loja não informado"} />
        <View style={styles.routeDivider} />
        <RouteLine label="Entrega" value={order.customerAddress || "Endereço do cliente não informado"} />
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Tipo" value={getFulfillmentText(order)} />
        <Meta label="Itens" value={`${itemCount}`} />
        <Meta label="Pagamento" value={`${formatPaymentMethod(order.paymentMethod)} · ${formatPaymentStatus(order.paymentStatus)}`} />
        <Meta label="Total" value={currencyFormatter.format(order.total)} />
      </View>

      {order.notes ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Observação</Text>
          <Text style={styles.noteText}>{order.notes}</Text>
        </View>
      ) : null}

      <View style={styles.customerBox}>
        <Text style={styles.customerLabel}>Cliente</Text>
        <Text style={styles.customerText}>{order.customerName}</Text>
        <Text style={styles.customerMuted}>{order.customerPhone}</Text>
      </View>

      {actionLabel && onAction ? (
        <CourierButton
          disabled={disabled}
          label={actionLabel}
          onPress={onAction}
          testID={actionTestID}
        />
      ) : null}
    </CourierCard>
  );
}

function RouteLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeLine}>
      <View style={styles.routeDot} />
      <View style={styles.routeCopy}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeValue}>{value}</Text>
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: courierTheme.spacing.md
  },
  titleBlock: {
    flex: 1,
    gap: 4
  },
  orderNumber: {
    color: courierTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1
  },
  storeName: {
    color: courierTheme.colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  routeBox: {
    gap: 10,
    padding: courierTheme.spacing.md,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  routeLine: {
    flexDirection: "row",
    gap: 10
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    backgroundColor: courierTheme.colors.primary
  },
  routeCopy: {
    flex: 1,
    gap: 2
  },
  routeLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  routeValue: {
    color: courierTheme.colors.text,
    lineHeight: 20
  },
  routeDivider: {
    height: 1,
    marginLeft: 5,
    backgroundColor: courierTheme.colors.border
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metaItem: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: 3,
    padding: 12,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  metaLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metaValue: {
    color: courierTheme.colors.text,
    fontWeight: "800"
  },
  noteBox: {
    gap: 4,
    padding: 12,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.warningSoft,
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.24)"
  },
  noteLabel: {
    color: courierTheme.colors.warning,
    fontWeight: "900",
    fontSize: 12
  },
  noteText: {
    color: courierTheme.colors.text,
    lineHeight: 20
  },
  customerBox: {
    gap: 3
  },
  customerLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  customerText: {
    color: courierTheme.colors.text,
    fontWeight: "900"
  },
  customerMuted: {
    color: courierTheme.colors.textMuted
  }
});
