import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";

export function ProtectedRoute({
  children
}: {
  children: React.ReactElement;
}) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="screen-state">Carregando sessão...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
