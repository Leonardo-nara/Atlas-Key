import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

export function LoginPage() {
  const { isAuthenticated, isLoggingIn, login, loginError } = useAuth();
  const [email, setEmail] = useState("store-admin@example.com");
  const [password, setPassword] = useState("StrongPass123");
  const [localError, setLocalError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Preencha email e senha para continuar.");
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      setLocalError("Nao foi possivel entrar agora. Revise a conta da loja ou a conexao com o backend.");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="section-kicker">Acesso</p>
        <h1>Painel da loja</h1>
        <p className="muted-text">
          Entre com sua conta de administrador da loja para gerenciar produtos e
          pedidos. Para demonstração local, a conta seed padrão é
          `store-admin@example.com`.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="store-admin@example.com"
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Sua senha"
            />
          </label>

          {loginError || localError ? (
            <div className="feedback feedback-error">
              {loginError ?? localError}
            </div>
          ) : null}

          <button className="primary-button" disabled={isLoggingIn} type="submit">
            {isLoggingIn ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
