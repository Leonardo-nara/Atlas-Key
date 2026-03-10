import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

function HomePage() {
  const navigate = useNavigate();

  return (
    <AppShell
      title="Atlas Key"
      subtitle="Catálogo inteligente de chaves para chaveiro"
    >
      <section className="mb-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">
          Acesso rápido
        </h2>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => navigate("/cadastrar-chave")}
            className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="block text-base font-semibold text-slate-900">
              Cadastrar chave
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Salvar nova chave no catálogo
            </span>
          </button>

          <button
            onClick={() => navigate("/catalogo")}
            className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="block text-base font-semibold text-slate-900">
              Catálogo
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Ver chaves já cadastradas
            </span>
          </button>

          <button
            onClick={() => navigate("/historico")}
            className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="block text-base font-semibold text-slate-900">
              Histórico
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Consultar buscas e confirmações
            </span>
          </button>

          <button
            onClick={() => navigate("/perfil")}
            className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <span className="block text-base font-semibold text-slate-900">
              Perfil
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Ver dados da conta e sair
            </span>
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Próximo passo: buscar chave do cliente por foto e salvar imagens reais
          no catálogo.
        </p>
      </section>
    </AppShell>
  );
}

export default HomePage;
