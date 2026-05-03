import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { mobileShadow, mobileTheme } from "../theme";

export function ScreenContainer({
  children,
  scrollable = false,
  contentStyle,
  cardStyle
}: {
  children: ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
}) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true
    }).start();
  }, [entrance]);

  const animatedStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0]
        })
      }
    ]
  };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.innerCard, cardStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>
      <Animated.View style={[styles.innerCard, cardStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        style={styles.keyboardArea}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: mobileTheme.colors.background
  },
  keyboardArea: {
    flex: 1
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -140,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: "rgba(62, 162, 255, 0.16)"
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -180,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: "rgba(22, 119, 216, 0.08)"
  },
  content: {
    flex: 1,
    padding: mobileTheme.spacing.lg
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: mobileTheme.spacing.lg,
    paddingTop: mobileTheme.spacing.md,
    paddingBottom: mobileTheme.spacing.xl
  },
  innerCard: {
    gap: mobileTheme.spacing.lg,
    padding: mobileTheme.spacing.lg,
    borderRadius: mobileTheme.radii.lg,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    ...mobileShadow
  }
});
