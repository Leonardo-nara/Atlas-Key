import { createHashRouter, Navigate } from "react-router-dom";
import type { ReactElement } from "react";

import { useAuth } from "./features/auth/auth-context";
import { AdminCouriersPage } from "./pages/AdminCouriersPage";
import { AdminStoresPage } from "./pages/AdminStoresPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { CouriersPage } from "./pages/CouriersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeliveryZonesPage } from "./pages/DeliveryZonesPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PixSettingsPage } from "./pages/PixSettingsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProtectedRoute } from "./shared/routing/ProtectedRoute";
import { AppLayout } from "./shared/layout/AppLayout";

export const appRouter = createHashRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: "products",
        element: (
          <RoleRoute role="STORE_ADMIN">
            <ProductsPage />
          </RoleRoute>
        )
      },
      {
        path: "orders",
        element: (
          <RoleRoute role="STORE_ADMIN">
            <OrdersPage />
          </RoleRoute>
        )
      },
      {
        path: "couriers",
        element: (
          <RoleRoute role="STORE_ADMIN">
            <CouriersPage />
          </RoleRoute>
        )
      },
      {
        path: "delivery-zones",
        element: (
          <RoleRoute role="STORE_ADMIN">
            <DeliveryZonesPage />
          </RoleRoute>
        )
      },
      {
        path: "pix-settings",
        element: (
          <RoleRoute role="STORE_ADMIN">
            <PixSettingsPage />
          </RoleRoute>
        )
      },
      {
        path: "admin/stores",
        element: (
          <RoleRoute role="PLATFORM_ADMIN">
            <AdminStoresPage />
          </RoleRoute>
        )
      },
      {
        path: "admin/users",
        element: (
          <RoleRoute role="PLATFORM_ADMIN">
            <AdminUsersPage />
          </RoleRoute>
        )
      },
      {
        path: "admin/couriers",
        element: (
          <RoleRoute role="PLATFORM_ADMIN">
            <AdminCouriersPage />
          </RoleRoute>
        )
      }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);

function RoleRoute({
  role,
  children
}: {
  role: "PLATFORM_ADMIN" | "STORE_ADMIN";
  children: ReactElement;
}) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
