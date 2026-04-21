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
      setLocalError(
        "Nao foi possivel entrar agora. Revise a conta da loja ou a conexao com o backend."
      );
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-card-copy">
          <div className="login-copy-block">
            <p className="section-kicker">Painel da empresa</p>
            <h1 className="login-title">Controle de pedidos, catalogo e operacao em um unico lugar.</h1>
            <p className="muted-text">
              Entre com sua conta de administrador para acompanhar produtos,
              pedidos e motoboys vinculados com uma interface pronta para uso real.
            </p>
          </div>

          <div className="info-grid">
            <article className="info-card">
              <span className="info-label">Operacao</span>
              <strong>Tempo real e historico</strong>
              <p>Pedidos, cancelamentos e atualizacoes com contexto claro.</p>
            </article>
            <article className="info-card">
              <span className="info-label">Equipe</span>
              <strong>Gestao de motoboys</strong>
              <p>Aprove solicitacoes e acompanhe quem ja pode operar.</p>
            </article>
          </div>
        </div>

        <div className="login-card-form">
          <p className="section-kicker">Acesso seguro</p>
          <h1>Entrar</h1>
          <p className="muted-text">
            Para demonstracao local, a conta seed padrao e
            <strong> store-admin@example.com</strong>.
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
        </div>
      </section>
    </main>
  );
}
