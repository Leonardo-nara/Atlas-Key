import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleCriarConta() {
    setMensagem("");
    setCarregando(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    console.log("SIGN UP DATA:", data);
    console.log("SIGN UP ERROR:", error);

    if (error) {
      setMensagem(error.message);
      setCarregando(false);
      return;
    }

    setMensagem(
      "Conta criada com sucesso. Confira seu e-mail ou tente entrar.",
    );
    setCarregando(false);
  }

  async function handleEntrar() {
    setMensagem("");
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    console.log("LOGIN DATA:", data);
    console.log("LOGIN ERROR:", error);

    if (error) {
      setMensagem(error.message);
      setCarregando(false);
      return;
    }

    setMensagem("Login realizado com sucesso.");
    setCarregando(false);
    navigate("/home");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-500 p-5 text-white shadow-xl">
          <p className="text-sm font-medium text-teal-100">Atlas</p>
          <h1 className="mt-1 text-3xl font-bold">Entrar</h1>
          <p className="mt-2 text-sm text-teal-50">
            Acesse sua conta para usar o Atlas Key
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <input
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
              />
            </div>

            {mensagem && (
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {mensagem}
              </div>
            )}

            <button
              type="button"
              onClick={handleEntrar}
              disabled={carregando}
              className="w-full rounded-2xl bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {carregando ? "Carregando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={handleCriarConta}
              disabled={carregando}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {carregando ? "Carregando..." : "Criar conta"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
