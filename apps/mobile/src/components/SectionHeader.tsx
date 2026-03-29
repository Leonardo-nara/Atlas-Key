import { StyleSheet, Text, View } from "react-native";

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
    gap: 6
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#8a5a00"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2933"
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#52606d"
  }
});
