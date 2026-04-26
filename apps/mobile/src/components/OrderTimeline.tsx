import { StyleSheet, Text, View } from "react-native";

import {
  getOrderTimeline,
  type OrderTimelineStep,
  type OrderTimelineAudience
} from "../features/orders/order-display";
import { mobileTheme } from "../theme";
import type { Order } from "../types/api";

export function OrderTimeline({
  audience,
  order
}: {
  audience: OrderTimelineAudience;
  order: Order;
}) {
  const steps = getOrderTimeline(order, audience);

  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => (
        <TimelineItem
          isLast={index >= steps.length - 1}
          key={step.key}
          step={step}
        />
      ))}
    </View>
  );
}

function TimelineItem({
  isLast,
  step
}: {
  isLast: boolean;
  step: OrderTimelineStep;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.markerColumn}>
        <View style={[styles.dot, getDotStyle(step.state)]} />
        {!isLast ? (
          <View style={[styles.connector, getConnectorStyle(step.state)]} />
        ) : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, getTitleStyle(step.state)]}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
      </View>
    </View>
  );
}

function getDotStyle(state: OrderTimelineStep["state"]) {
  if (state === "done") {
    return styles.dot_done;
  }

  if (state === "active") {
    return styles.dot_active;
  }

  if (state === "cancelled") {
    return styles.dot_cancelled;
  }

  return styles.dot_upcoming;
}

function getConnectorStyle(state: OrderTimelineStep["state"]) {
  if (state === "done") {
    return styles.connector_done;
  }

  if (state === "active") {
    return styles.connector_active;
  }

  if (state === "cancelled") {
    return styles.connector_cancelled;
  }

  return styles.connector_upcoming;
}

function getTitleStyle(state: OrderTimelineStep["state"]) {
  if (state === "done") {
    return styles.title_done;
  }

  if (state === "active") {
    return styles.title_active;
  }

  if (state === "cancelled") {
    return styles.title_cancelled;
  }

  return styles.title_upcoming;
}

const styles = StyleSheet.create({
  timeline: {
    padding: 14,
    borderRadius: mobileTheme.radii.md,
    backgroundColor: mobileTheme.colors.surface,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    gap: 2
  },
  item: {
    flexDirection: "row",
    gap: 12
  },
  markerColumn: {
    alignItems: "center",
    width: 18
  },
  dot: {
    width: 13,
    height: 13,
    marginTop: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.surface
  },
  dot_done: {
    borderColor: mobileTheme.colors.success,
    backgroundColor: mobileTheme.colors.success
  },
  dot_active: {
    borderColor: mobileTheme.colors.primaryStrong,
    backgroundColor: mobileTheme.colors.primaryStrong
  },
  dot_upcoming: {
    borderColor: mobileTheme.colors.borderStrong,
    backgroundColor: mobileTheme.colors.surface
  },
  dot_cancelled: {
    borderColor: mobileTheme.colors.danger,
    backgroundColor: mobileTheme.colors.danger
  },
  connector: {
    flex: 1,
    minHeight: 28,
    width: 2,
    marginTop: 3,
    backgroundColor: mobileTheme.colors.border
  },
  connector_done: {
    backgroundColor: mobileTheme.colors.success
  },
  connector_active: {
    backgroundColor: mobileTheme.colors.primaryStrong
  },
  connector_upcoming: {
    backgroundColor: mobileTheme.colors.border
  },
  connector_cancelled: {
    backgroundColor: mobileTheme.colors.danger
  },
  content: {
    flex: 1,
    paddingBottom: 14,
    gap: 3
  },
  title: {
    fontWeight: "800",
    color: mobileTheme.colors.text
  },
  title_done: {
    color: mobileTheme.colors.success
  },
  title_active: {
    color: mobileTheme.colors.primaryStrong
  },
  title_upcoming: {
    color: mobileTheme.colors.textSoft
  },
  title_cancelled: {
    color: mobileTheme.colors.danger
  },
  description: {
    color: mobileTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  }
});
