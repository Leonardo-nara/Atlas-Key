import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getOrderTimeline } from "../features/orders/order-display";
import { mobileTheme } from "../theme";
import type { Order } from "../types/api";

export const courierTheme = {
  colors: {
    background: "#050B14",
    backgroundSecondary: "#07111E",
    surface: "#0D1C2B",
    surfaceElevated: "#12263A",
    surfaceHover: "#15314D",
    border: "#1D3954",
    primary: "#38BDF8",
    secondary: "#60A5FA",
    primaryStrong: "#2563EB",
    text: "#F5FAFF",
    textMuted: "#91A6BA",
    success: "#34D399",
    warning: "#FB923C",
    danger: "#F87171",
    successSoft: "rgba(52, 211, 153, 0.12)",
    warningSoft: "rgba(251, 146, 60, 0.14)",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    primarySoft: "rgba(56, 189, 248, 0.13)"
  },
  spacing: mobileTheme.spacing,
  radii: mobileTheme.radii
} as const;

export function CourierScreen({
  children,
  padded = true,
  style
}: {
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true
    }).start();
  }, [entrance]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <Animated.View
        style={[
          styles.screen,
          padded ? styles.screenPadded : undefined,
          style,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0]
                })
              }
            ]
          }
        ]}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

export function CourierHeader({
  eyebrow = "Mototake Entregador",
  title,
  description,
  right
}: {
  eyebrow?: string;
  title: string;
  description: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {right}
    </View>
  );
}

export function CourierCard({
  children,
  highlighted = false,
  style
}: {
  children: ReactNode;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, highlighted ? styles.cardHighlighted : undefined, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function StatusPill({
  label,
  tone = "info"
}: {
  label: string;
  tone?: "info" | "success" | "warning" | "danger" | "muted";
}) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function CourierButton({
  label,
  onPress,
  disabled,
  variant = "primary"
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && !disabled ? styles.buttonPressed : undefined,
        disabled ? styles.buttonDisabled : undefined
      ]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
    </Pressable>
  );
}

export function FeedbackBanner({
  message,
  tone = "info"
}: {
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <View style={[styles.banner, styles[`banner_${tone}`]]}>
      <Text style={[styles.bannerText, styles[`bannerText_${tone}`]]}>{message}</Text>
    </View>
  );
}

export function CourierState({
  title,
  description,
  loading = false,
  tone = "empty"
}: {
  title: string;
  description?: string;
  loading?: boolean;
  tone?: "empty" | "error" | "success" | "warning";
}) {
  return (
    <CourierCard style={styles.stateCard}>
      {loading ? <ActivityIndicator color={courierTheme.colors.primary} /> : null}
      <Text style={[styles.stateTitle, tone === "error" ? styles.stateTitleError : undefined]}>
        {title}
      </Text>
      {description ? <Text style={styles.stateDescription}>{description}</Text> : null}
    </CourierCard>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

export function CourierProgressTimeline({ order }: { order: Order }) {
  const steps = getOrderTimeline(order, "courier");

  return (
    <CourierCard style={styles.timelineCard}>
      <SectionTitle
        title="Progresso da entrega"
        description="Etapas reais do pedido sincronizadas com a empresa."
      />
      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  step.state === "done" ? styles.timelineDotCompleted : undefined,
                  step.state === "active" ? styles.timelineDotCurrent : undefined,
                  step.state === "cancelled" ? styles.timelineDotCancelled : undefined
                ]}
              />
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.timelineLine,
                    step.state === "done" ? styles.timelineLineCompleted : undefined
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.timelineCopy}>
              <Text
                style={[
                  styles.timelineTitle,
                  step.state === "done" || step.state === "active"
                    ? styles.timelineTitleActive
                    : undefined,
                  step.state === "cancelled" ? styles.timelineTitleCancelled : undefined
                ]}
              >
                {step.title}
              </Text>
              {step.description ? (
                <Text style={styles.timelineDescription}>{step.description}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </CourierCard>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: courierTheme.colors.background
  },
  screen: {
    flex: 1,
    gap: courierTheme.spacing.lg
  },
  screenPadded: {
    paddingHorizontal: courierTheme.spacing.lg,
    paddingTop: courierTheme.spacing.md
  },
  glowTop: {
    position: "absolute",
    top: -130,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.16)"
  },
  glowBottom: {
    position: "absolute",
    bottom: -180,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.12)"
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: courierTheme.spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: 6
  },
  eyebrow: {
    color: courierTheme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  title: {
    color: courierTheme.colors.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34
  },
  description: {
    color: courierTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  card: {
    gap: courierTheme.spacing.md,
    padding: courierTheme.spacing.lg,
    borderRadius: courierTheme.radii.lg,
    backgroundColor: courierTheme.colors.surface,
    borderWidth: 1,
    borderColor: courierTheme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8
  },
  cardHighlighted: {
    borderColor: courierTheme.colors.primary,
    backgroundColor: courierTheme.colors.surfaceElevated
  },
  sectionTitle: {
    gap: 4
  },
  sectionHeading: {
    color: courierTheme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  sectionDescription: {
    color: courierTheme.colors.textMuted,
    lineHeight: 20
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: courierTheme.radii.pill,
    borderWidth: 1
  },
  pill_info: {
    backgroundColor: courierTheme.colors.primarySoft,
    borderColor: "rgba(56, 189, 248, 0.28)"
  },
  pill_success: {
    backgroundColor: courierTheme.colors.successSoft,
    borderColor: "rgba(52, 211, 153, 0.28)"
  },
  pill_warning: {
    backgroundColor: courierTheme.colors.warningSoft,
    borderColor: "rgba(251, 146, 60, 0.3)"
  },
  pill_danger: {
    backgroundColor: courierTheme.colors.dangerSoft,
    borderColor: "rgba(248, 113, 113, 0.3)"
  },
  pill_muted: {
    backgroundColor: "rgba(145, 166, 186, 0.11)",
    borderColor: courierTheme.colors.border
  },
  pillText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  pillText_info: {
    color: courierTheme.colors.primary
  },
  pillText_success: {
    color: courierTheme.colors.success
  },
  pillText_warning: {
    color: courierTheme.colors.warning
  },
  pillText_danger: {
    color: courierTheme.colors.danger
  },
  pillText_muted: {
    color: courierTheme.colors.textMuted
  },
  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: courierTheme.radii.md,
    borderWidth: 1,
    paddingHorizontal: courierTheme.spacing.md
  },
  button_primary: {
    backgroundColor: courierTheme.colors.primary,
    borderColor: courierTheme.colors.primary
  },
  button_secondary: {
    backgroundColor: courierTheme.colors.primarySoft,
    borderColor: "rgba(56, 189, 248, 0.3)"
  },
  button_danger: {
    backgroundColor: courierTheme.colors.dangerSoft,
    borderColor: "rgba(248, 113, 113, 0.36)"
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }]
  },
  buttonDisabled: {
    opacity: 0.52
  },
  buttonText: {
    fontWeight: "900",
    fontSize: 15
  },
  buttonText_primary: {
    color: "#03111E"
  },
  buttonText_secondary: {
    color: courierTheme.colors.primary
  },
  buttonText_danger: {
    color: courierTheme.colors.danger
  },
  banner: {
    padding: courierTheme.spacing.md,
    borderRadius: courierTheme.radii.md,
    borderWidth: 1
  },
  banner_info: {
    backgroundColor: courierTheme.colors.primarySoft,
    borderColor: "rgba(56, 189, 248, 0.28)"
  },
  banner_success: {
    backgroundColor: courierTheme.colors.successSoft,
    borderColor: "rgba(52, 211, 153, 0.28)"
  },
  banner_warning: {
    backgroundColor: courierTheme.colors.warningSoft,
    borderColor: "rgba(251, 146, 60, 0.28)"
  },
  banner_danger: {
    backgroundColor: courierTheme.colors.dangerSoft,
    borderColor: "rgba(248, 113, 113, 0.28)"
  },
  bannerText: {
    fontWeight: "800",
    lineHeight: 20
  },
  bannerText_info: {
    color: courierTheme.colors.primary
  },
  bannerText_success: {
    color: courierTheme.colors.success
  },
  bannerText_warning: {
    color: courierTheme.colors.warning
  },
  bannerText_danger: {
    color: courierTheme.colors.danger
  },
  stateCard: {
    alignItems: "center"
  },
  stateTitle: {
    color: courierTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center"
  },
  stateTitleError: {
    color: courierTheme.colors.danger
  },
  stateDescription: {
    color: courierTheme.colors.textMuted,
    textAlign: "center",
    lineHeight: 21
  },
  metric: {
    flex: 1,
    minWidth: 118,
    gap: 4,
    padding: courierTheme.spacing.md,
    borderRadius: courierTheme.radii.md,
    backgroundColor: courierTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  metricLabel: {
    color: courierTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    color: courierTheme.colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  metricDetail: {
    color: courierTheme.colors.textMuted,
    fontSize: 12
  },
  timelineCard: {
    padding: courierTheme.spacing.md
  },
  timeline: {
    gap: 0
  },
  timelineRow: {
    flexDirection: "row",
    gap: courierTheme.spacing.sm
  },
  timelineRail: {
    alignItems: "center",
    width: 18
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: courierTheme.colors.surfaceHover,
    borderWidth: 1,
    borderColor: courierTheme.colors.border
  },
  timelineDotCompleted: {
    backgroundColor: courierTheme.colors.success,
    borderColor: courierTheme.colors.success
  },
  timelineDotCurrent: {
    backgroundColor: courierTheme.colors.primary,
    borderColor: courierTheme.colors.primary
  },
  timelineDotCancelled: {
    backgroundColor: courierTheme.colors.danger,
    borderColor: courierTheme.colors.danger
  },
  timelineLine: {
    flex: 1,
    minHeight: 30,
    width: 2,
    backgroundColor: courierTheme.colors.border
  },
  timelineLineCompleted: {
    backgroundColor: courierTheme.colors.success
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: courierTheme.spacing.sm
  },
  timelineTitle: {
    color: courierTheme.colors.textMuted,
    fontWeight: "800"
  },
  timelineTitleActive: {
    color: courierTheme.colors.text
  },
  timelineTitleCancelled: {
    color: courierTheme.colors.danger
  },
  timelineDescription: {
    color: courierTheme.colors.textMuted,
    lineHeight: 19,
    marginTop: 2
  }
});
