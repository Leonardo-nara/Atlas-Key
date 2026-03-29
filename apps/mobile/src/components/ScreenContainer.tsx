import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

export function ScreenContainer({
  children,
  scrollable = false
}: {
  children: ReactNode;
  scrollable?: boolean;
}) {
  const content = scrollable ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5efe2"
  },
  content: {
    flex: 1,
    padding: 20
  },
  scrollContent: {
    padding: 20,
    gap: 16
  }
});
