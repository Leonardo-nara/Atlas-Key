import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./features/auth/auth-context";
import { RealtimeProvider } from "./features/realtime/realtime-context";
import { RootNavigator } from "./navigation/RootNavigator";

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </RealtimeProvider>
    </AuthProvider>
  );
}
