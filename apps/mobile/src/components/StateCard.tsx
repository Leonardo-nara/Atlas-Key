import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { mobileTheme } from "../theme";

interface StateCardProps {
  title: string;
  description?: string;
  variant?: "loading" | "empty" | "error" | "success" | "warning";
}

export function StateCard({
  title,
  description,
  variant = "empty"
}: StateCardProps) {
  const isLoading = variant === "loading";

  return (
    <View style={[styles.card, styles[variant]]}>
      {isLoading ? (
        <ActivityIndicator color={mobileTheme.colors.primaryStrong} size="small" />
      ) : null}
      <Text style={[styles.title, variant === "error" ? styles.errorTitle : undefined]}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    gap: mobileTheme.spacing.xs,
    padding: mobileTheme.spacing.lg
  },
  loading: {
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderColor: mobileTheme.colors.border
  },
  empty: {
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderColor: mobileTheme.colors.border
  },
  error: {
    backgroundColor: mobileTheme.colors.dangerSoft,
    borderColor: "rgba(217, 79, 92, 0.22)"
  },
  success: {
    backgroundColor: mobileTheme.colors.successSoft,
    borderColor: "rgba(31, 157, 104, 0.22)"
  },
  warning: {
    backgroundColor: mobileTheme.colors.warningSoft,
    borderColor: "rgba(196, 131, 28, 0.22)"
  },
  title: {
    color: mobileTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center"
  },
  errorTitle: {
    color: mobileTheme.colors.danger
  },
  description: {
    color: mobileTheme.colors.textMuted,
    lineHeight: 20,
    textAlign: "center"
  }
});
