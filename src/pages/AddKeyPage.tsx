import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { supabase } from "../lib/supabase";

function AddKeyPage() {
  const navigate = useNavigate();

  const [nomeModelo, setNomeModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMensagem("Usuário não encontrado.");
      setCarregando(false);
      return;
    }

    const { error } = await supabase.from("catalog_keys").insert({
      user_id: user.id,
      nome_modelo: nomeModelo,
      marca: marca || null,
      categoria: categoria || null,
      etiqueta: etiqueta || null,
      localizacao: localizacao || null,
      observacoes: observacoes || null,
      foto_url: fotoUrl || "sem-foto",
    });

    if (error) {
      setMensagem("Erro ao salvar chave.");
      setCarregando(false);
      return;
    }

    setMensagem("Chave cadastrada com sucesso.");

    setNomeModelo("");
    setMarca("");
    setCategoria("");
    setEtiqueta("");
    setLocalizacao("");
    setObservacoes("");
    setFotoUrl("");
    setCarregando(false);

    setTimeout(() => {
      navigate("/catalogo");
    }, 700);
  }

  return (
    <AppShell
      title="Cadastrar chave"
      subtitle="Adicione uma nova chave ao catálogo"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl bg-white p-4 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nome / Modelo
          </label>
          <input
            value={nomeModelo}
            onChange={(e) => setNomeModelo(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Ex: Yale 001"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Marca
          </label>
          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Ex: Yale"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Categoria
          </label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Ex: Residencial"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Etiqueta
          </label>
          <input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Ex: YALE"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Localização
          </label>
          <input
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Ex: Parede A, fileira 2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Observações
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Detalhes importantes da chave"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            URL da foto
          </label>
          <input
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Por enquanto, pode deixar vazio"
          />
        </div>

        {mensagem && (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {mensagem}
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-2xl bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {carregando ? "Salvando..." : "Salvar chave"}
        </button>
      </form>
    </AppShell>
  );
}

export default AddKeyPage;
