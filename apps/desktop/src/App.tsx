import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./features/auth/auth-context";
import { RealtimeProvider } from "./features/realtime/realtime-context";
import { appRouter } from "./router";
import { DesktopUpdateNotice } from "./shared/ui/DesktopUpdateNotice";

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <RouterProvider router={appRouter} />
        <DesktopUpdateNotice />
      </RealtimeProvider>
    </AuthProvider>
  );
}
