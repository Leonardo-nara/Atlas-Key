import { ActivityIndicator, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../features/auth/auth-context";
import { useCart } from "../features/cart/cart-context";
import { AvailableOrdersScreen } from "../screens/AvailableOrdersScreen";
import { ClientCartScreen } from "../screens/ClientCartScreen";
import { ClientOrdersScreen } from "../screens/ClientOrdersScreen";
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
import { courierTheme } from "../components/courier-ui";
import { mobileTheme } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ClientStack = createNativeStackNavigator();

function CourierTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: courierTheme.colors.primary,
        tabBarInactiveTintColor: courierTheme.colors.textMuted,
        tabBarIcon: () => null,
        tabBarIconStyle: {
          display: "none"
        },
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom, 10),
          height: 66 + bottomPadding,
          paddingTop: 10,
          paddingBottom: bottomPadding,
          backgroundColor: "rgba(13, 28, 43, 0.98)",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: courierTheme.colors.border,
          borderRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.28,
          shadowRadius: 22,
          elevation: 18
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "900"
        },
        sceneStyle: {
          backgroundColor: courierTheme.colors.background
        }
      }}
    >
      <Tab.Screen
        component={AvailableOrdersScreen}
        name="AvailableOrders"
        options={{ title: "Início" }}
      />
      <Tab.Screen
        component={CompaniesScreen}
        name="Companies"
        options={{ title: "Empresas" }}
      />
      <Tab.Screen
        component={MyOrdersScreen}
        name="MyOrders"
        options={{ title: "Entregas" }}
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
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

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
        tabBarIcon: () => null,
        tabBarIconStyle: {
          display: "none"
        },
        tabBarStyle: {
          height: 62 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
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
        component={ClientCartScreen}
        name="ClientCart"
        options={{
          title: "Carrinho",
          tabBarBadge: itemCount > 0 ? itemCount : undefined
        }}
      />
      <Tab.Screen
        component={ClientOrdersScreen}
        name="ClientOrders"
        options={{ title: "Pedidos" }}
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
