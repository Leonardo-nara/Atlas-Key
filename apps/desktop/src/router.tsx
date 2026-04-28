import { createHashRouter, Navigate } from "react-router-dom";

import { CouriersPage } from "./pages/CouriersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeliveryZonesPage } from "./pages/DeliveryZonesPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
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
        element: <ProductsPage />
      },
      {
        path: "orders",
        element: <OrdersPage />
      },
      {
        path: "couriers",
        element: <CouriersPage />
      },
      {
        path: "delivery-zones",
        element: <DeliveryZonesPage />
      }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);
