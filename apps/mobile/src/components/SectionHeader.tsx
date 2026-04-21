import { StyleSheet, Text, View } from "react-native";

import { mobileTheme } from "../theme";

export function SectionHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Operação</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: mobileTheme.spacing.xs
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: mobileTheme.colors.primaryStrong,
    fontWeight: "700"
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: mobileTheme.colors.text
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: mobileTheme.colors.textMuted
  }
});
