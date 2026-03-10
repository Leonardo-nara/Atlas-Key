import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import AddKeyPage from "./pages/AddKeyPage";
import SearchKeyPage from "./pages/SearchKeyPage";
function App() {
  const [loading, setLoading] = useState(true);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    async function verificarSessao() {
      const { data } = await supabase.auth.getSession();
      setLogado(!!data.session);
      setLoading(false);
    }

    verificarSessao();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setLogado(!!session);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={logado ? "/home" : "/login"} replace />}
      />
      <Route
        path="/buscar-chave"
        element={logado ? <SearchKeyPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/cadastrar-chave"
        element={logado ? <AddKeyPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={logado ? <Navigate to="/home" replace /> : <LoginPage />}
      />
      <Route
        path="/home"
        element={logado ? <HomePage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/catalogo"
        element={logado ? <CatalogPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/historico"
        element={logado ? <HistoryPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/perfil"
        element={logado ? <ProfilePage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;
