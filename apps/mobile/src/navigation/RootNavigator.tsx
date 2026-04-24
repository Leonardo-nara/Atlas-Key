import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../features/auth/auth-context";
import { AvailableOrdersScreen } from "../screens/AvailableOrdersScreen";
import { ClientProfileScreen } from "../screens/ClientProfileScreen";
import { ClientRegisterScreen } from "../screens/ClientRegisterScreen";
import { ClientStoreProductsScreen } from "../screens/ClientStoreProductsScreen";
import { ClientStoresScreen } from "../screens/ClientStoresScreen";
import { CompaniesScreen } from "../screens/CompaniesScreen";
import { CompleteProfileScreen } from "../screens/CompleteProfileScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MyOrdersScreen } from "../screens/MyOrdersScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { mobileTheme } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ClientStack = createNativeStackNavigator();

function CourierTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: mobileTheme.colors.background
        },
        headerTitleStyle: {
          color: mobileTheme.colors.text,
          fontWeight: "800"
        },
        tabBarActiveTintColor: mobileTheme.colors.primaryStrong,
        tabBarInactiveTintColor: mobileTheme.colors.textSoft,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 1,
          borderTopColor: mobileTheme.colors.border
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700"
        },
        sceneStyle: {
          backgroundColor: mobileTheme.colors.background
        }
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

function ClientHomeStack() {
  return (
    <ClientStack.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: mobileTheme.colors.background
        },
        headerTitleStyle: {
          color: mobileTheme.colors.text,
          fontWeight: "800"
        },
        contentStyle: {
          backgroundColor: mobileTheme.colors.background
        }
      }}
    >
      <ClientStack.Screen
        component={ClientStoresScreen}
        name="ClientStores"
        options={{ title: "Empresas" }}
      />
      <ClientStack.Screen
        component={ClientStoreProductsScreen}
        name="ClientStoreProducts"
        options={{ title: "Produtos" }}
      />
    </ClientStack.Navigator>
  );
}

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: mobileTheme.colors.background
        },
        headerTitleStyle: {
          color: mobileTheme.colors.text,
          fontWeight: "800"
        },
        tabBarActiveTintColor: mobileTheme.colors.primaryStrong,
        tabBarInactiveTintColor: mobileTheme.colors.textSoft,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTopWidth: 1,
          borderTopColor: mobileTheme.colors.border
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700"
        },
        sceneStyle: {
          backgroundColor: mobileTheme.colors.background
        }
      }}
    >
      <Tab.Screen
        component={ClientHomeStack}
        name="ClientCatalog"
        options={{ title: "Empresas", headerShown: false }}
      />
      <Tab.Screen
        component={ClientProfileScreen}
        name="ClientProfile"
        options={{ title: "Perfil" }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const {
    isAuthenticated,
    isBootstrapping,
    needsProfileCompletion,
    isCourier,
    isClient
  } = useAuth();

  if (isBootstrapping) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: mobileTheme.colors.background
        }}
      >
        <ActivityIndicator color={mobileTheme.colors.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        isCourier ? (
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
        ) : isClient ? (
          <Stack.Screen component={ClientTabs} name="ClientTabs" />
        ) : (
          <>
            <Stack.Screen component={LoginScreen} name="Login" />
          </>
        )
      ) : (
        <>
          <Stack.Screen component={LoginScreen} name="Login" />
          <Stack.Screen component={RegisterScreen} name="RegisterCourier" />
          <Stack.Screen component={ClientRegisterScreen} name="RegisterClient" />
        </>
      )}
    </Stack.Navigator>
  );
}
