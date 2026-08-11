import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";

const MIN_PASSWORD_LENGTH = 6;

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
    "login"
  );
  const [email, setEmail] = useState(
    isDevelopment ? "store-admin@example.com" : ""
  );
  const [password, setPassword] = useState(
    isDevelopment ? "StrongPass123" : ""
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setLocalError("Preencha empresa, responsavel, e-mail e senha para criar a conta.");
      return;
    }

    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      setLocalError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setLocalError("A confirmacao da senha precisa ser igual a senha informada.");
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
          <div className="login-brand-lockup">
            <div className="brand-mark">M</div>
            <div>
              <strong>Mototake</strong>
              <span>Painel empresarial</span>
            </div>
          </div>
          <div className="login-copy-block">
            <p className="section-kicker">Painel da empresa</p>
            <h1 className="login-title">
              Operacao profissional para{" "}
              <span>delivery, PDV e estoque.</span>
            </h1>
            <p className="muted-text">
              Entre com sua conta de administrador ou crie a empresa direto no
              Mototake para iniciar a operacao sem atrito.
            </p>
          </div>

          <div className="login-benefit-grid">
            <article className="info-card">
              <span className="login-info-icon" aria-hidden="true">
                <span className="clock-hand" />
              </span>
              <span className="info-label">Operacao</span>
              <strong>Tempo real e historico.</strong>
              <p>Pedidos, cancelamentos e atualizacoes com contexto claro.</p>
            </article>
            <article className="info-card">
              <span className="login-info-icon login-info-chart" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="info-label">Implantacao</span>
              <strong>Conexao rapida.</strong>
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
              ? "Use seu e-mail e senha para acessar o Mototake."
              : "Primeiro acesso? Crie a conta da empresa aqui e entre no painel imediatamente."}
          </p>
          <h1>{mode === "login" ? "Entrar" : "Criar conta da empresa"}</h1>
          <p className="muted-text">
            {mode === "login" ? (
              isDevelopment ? (
                <>
                  Para desenvolvimento local, a conta seed padrao e
                  <strong> store-admin@example.com</strong>.
                </>
              ) : (
                "Use seu e-mail e senha para acessar o Mototake."
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
              Criar minha empresa
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
                    placeholder="Ex.: Mototake Centro"
                    autoComplete="organization"
                  />
                </label>

                <label className="field">
                  <span>Responsavel</span>
                  <input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Nome de quem administra a operacao"
                    autoComplete="name"
                  />
                </label>
              </>
            ) : null}

            <label className="field">
              <span>E-mail</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder={isDevelopment ? "store-admin@example.com" : "empresa@dominio.com"}
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <div className="password-field">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>

            {mode === "register" ? (
              <>
                <label className="field">
                  <span>Confirmar senha</span>
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                  />
                </label>
                <p className="password-help">
                  Use pelo menos {MIN_PASSWORD_LENGTH} caracteres. Guarde essa senha com seguranca.
                </p>
              </>
            ) : null}

            {loginError || localError ? (
              <div className="feedback feedback-error" role="alert">
                <span className="login-error-icon" aria-hidden="true">!</span>
                <span>{loginError ?? localError}</span>
              </div>
            ) : null}

            <button
              className="primary-button login-submit-button"
              disabled={isLoggingIn || isRegistering}
              type="submit"
            >
              <span>
                {mode === "login"
                ? isLoggingIn
                  ? "Entrando..."
                  : "Entrar"
                : isRegistering
                  ? "Criando conta..."
                  : "Criar conta e entrar"}
              </span>
              <span className="login-submit-arrow" aria-hidden="true">-&gt;</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
