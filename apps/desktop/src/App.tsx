import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./features/auth/auth-context";
import { RealtimeProvider } from "./features/realtime/realtime-context";
import { appRouter } from "./router";

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <RouterProvider router={appRouter} />
      </RealtimeProvider>
    </AuthProvider>
  );
}
