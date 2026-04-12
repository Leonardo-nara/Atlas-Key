import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../features/auth/auth-context";
import { AvailableOrdersScreen } from "../screens/AvailableOrdersScreen";
import { CompaniesScreen } from "../screens/CompaniesScreen";
import { CompleteProfileScreen } from "../screens/CompleteProfileScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MyOrdersScreen } from "../screens/MyOrdersScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function CourierTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: "#b65b1c"
      }}
    >
      <Tab.Screen
        component={AvailableOrdersScreen}
        name="AvailableOrders"
        options={{ title: "Disponíveis" }}
      />
      <Tab.Screen
        component={CompaniesScreen}
        name="Companies"
        options={{ title: "Empresas" }}
      />
      <Tab.Screen
        component={MyOrdersScreen}
        name="MyOrders"
        options={{ title: "Meus pedidos" }}
      />
      <Tab.Screen
        component={ProfileScreen}
        name="Profile"
        options={{ title: "Perfil" }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isBootstrapping, needsProfileCompletion } = useAuth();

  if (isBootstrapping) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5efe2"
        }}
      >
        <ActivityIndicator color="#b65b1c" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        needsProfileCompletion ? (
          <>
            <Stack.Screen
              component={CompleteProfileScreen}
              initialParams={{ forceCompletion: true }}
              name="CompleteProfile"
            />
            <Stack.Screen component={CourierTabs} name="CourierTabs" />
          </>
        ) : (
          <>
            <Stack.Screen component={CourierTabs} name="CourierTabs" />
            <Stack.Screen
              component={CompleteProfileScreen}
              initialParams={{ forceCompletion: false }}
              name="CompleteProfile"
            />
          </>
        )
      ) : (
        <>
          <Stack.Screen component={LoginScreen} name="Login" />
          <Stack.Screen component={RegisterScreen} name="Register" />
        </>
      )}
    </Stack.Navigator>
  );
}
