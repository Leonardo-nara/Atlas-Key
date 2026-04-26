import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./features/auth/auth-context";
import { CartProvider } from "./features/cart/cart-context";
import { RealtimeProvider } from "./features/realtime/realtime-context";
import { RootNavigator } from "./navigation/RootNavigator";
import { mobileTheme } from "./theme";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RealtimeProvider>
          <NavigationContainer
            theme={{
              dark: false,
              colors: {
                primary: mobileTheme.colors.primaryStrong,
                background: mobileTheme.colors.background,
                card: mobileTheme.colors.surface,
                text: mobileTheme.colors.text,
                border: mobileTheme.colors.border,
                notification: mobileTheme.colors.danger
              },
              fonts: {
                regular: { fontFamily: "System", fontWeight: "400" },
                medium: { fontFamily: "System", fontWeight: "500" },
                bold: { fontFamily: "System", fontWeight: "700" },
                heavy: { fontFamily: "System", fontWeight: "800" }
              }
            }}
          >
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </RealtimeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
