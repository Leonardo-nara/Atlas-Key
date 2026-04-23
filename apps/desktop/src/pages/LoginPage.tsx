import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

export function LoginPage() {
  const isDevelopment = import.meta.env.DEV;
  const {
    isAuthenticated,
    isLoggingIn,
    isRegistering,
    login,
    registerStoreQuick,
    loginError
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(
    isDevelopment ? "login" : "register"
  );
  const [email, setEmail] = useState(
    isDevelopment ? "store-admin@example.com" : ""
  );
  const [password, setPassword] = useState(
    isDevelopment ? "StrongPass123" : ""
  );
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (mode === "login" && (!email.trim() || !password.trim())) {
      setLocalError("Preencha email e senha para continuar.");
      return;
    }

    if (
      mode === "register" &&
      (!storeName.trim() || !ownerName.trim() || !email.trim() || !password.trim())
    ) {
      setLocalError("Preencha empresa, responsavel, email e senha para criar a conta.");
      return;
    }

    if (password.trim().length < 6) {
      setLocalError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await registerStoreQuick(
          storeName.trim(),
          ownerName.trim(),
          email.trim(),
          password
        );
      }
    } catch {
      setLocalError(
        mode === "login"
          ? "Nao foi possivel entrar agora. Revise a conta da loja ou a conexao com o backend."
          : "Nao foi possivel criar a conta agora. Revise os dados e tente novamente."
      );
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-card-copy">
          <div className="login-copy-block">
            <p className="section-kicker">Painel da empresa</p>
            <h1 className="login-title">
              Controle de pedidos, catalogo e operacao em um unico lugar.
            </h1>
            <p className="muted-text">
              Entre com sua conta de administrador ou crie a empresa direto no
              desktop para iniciar a operacao sem atrito.
            </p>
          </div>

          <div className="info-grid">
            <article className="info-card">
              <span className="info-label">Operacao</span>
              <strong>Tempo real e historico</strong>
              <p>Pedidos, cancelamentos e atualizacoes com contexto claro.</p>
            </article>
            <article className="info-card">
              <span className="info-label">Implantacao</span>
              <strong>Comeco rapido</strong>
              <p>Crie a conta da empresa em poucos minutos e complete o restante depois.</p>
            </article>
          </div>
        </div>

        <div className="login-card-form">
          <p className="section-kicker">Acesso seguro</p>
          <div className="login-mode-toggle" role="tablist" aria-label="Modo de acesso">
            <button
              aria-selected={mode === "login"}
              className={mode === "login" ? "mode-chip mode-chip-active" : "mode-chip"}
              onClick={() => {
                setMode("login");
                setLocalError(null);
              }}
              role="tab"
              type="button"
            >
              Entrar
            </button>
            <button
              aria-selected={mode === "register"}
              className={mode === "register" ? "mode-chip mode-chip-active" : "mode-chip"}
              onClick={() => {
                setMode("register");
                setLocalError(null);
              }}
              role="tab"
              type="button"
            >
              Criar conta
            </button>
          </div>
          <p className="muted-text">
            {mode === "login"
              ? "Ja tem conta? Entre com o email corporativo e a senha da empresa."
              : "Primeiro acesso? Crie a conta da empresa aqui e entre no painel imediatamente."}
          </p>
          <h1>{mode === "login" ? "Entrar" : "Criar conta da empresa"}</h1>
          <p className="muted-text">
            {mode === "login" ? (
              isDevelopment ? (
                <>
                  Para demonstracao local, a conta seed padrao e
                  <strong> store-admin@example.com</strong>.
                </>
              ) : (
                "Use o email e a senha da conta da empresa para acessar o painel."
              )
            ) : (
              "A conta entra autenticada logo apos o cadastro. Endereco e ajustes operacionais podem ser completados depois."
            )}
          </p>

          {mode === "login" && !isDevelopment ? (
            <button
              className="secondary-button"
              onClick={() => {
                setMode("register");
                setLocalError(null);
              }}
              type="button"
            >
              Ainda nao tenho conta
            </button>
          ) : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <>
                <label className="field">
                  <span>Nome da empresa</span>
                  <input
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    placeholder="Ex.: RotaPronta Centro"
                  />
                </label>

                <label className="field">
                  <span>Responsavel</span>
                  <input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Nome de quem administra a operacao"
                  />
                </label>
              </>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder={isDevelopment ? "store-admin@example.com" : "empresa@dominio.com"}
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
              <div className="feedback feedback-error">{loginError ?? localError}</div>
            ) : null}

            <button
              className="primary-button"
              disabled={isLoggingIn || isRegistering}
              type="submit"
            >
              {mode === "login"
                ? isLoggingIn
                  ? "Entrando..."
                  : "Entrar"
                : isRegistering
                  ? "Criando conta..."
                  : "Criar conta e entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
