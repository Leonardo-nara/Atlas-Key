import { useState } from "react";
import type { FormEvent } from "react";
import AppShell from "../components/AppShell";
import { supabase } from "../lib/supabase";
import type { CatalogKey } from "../types/catalog";

function SearchKeyPage() {
  const [fotoClienteUrl, setFotoClienteUrl] = useState("");
  const [resultado, setResultado] = useState<CatalogKey | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleBuscar(e: FormEvent) {
    e.preventDefault();
    setMensagem("");
    setResultado(null);
    setCarregando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMensagem("Usuário não encontrado.");
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from("catalog_keys")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setMensagem("Erro ao buscar chave.");
      setCarregando(false);
      return;
    }

    if (!data || data.length === 0) {
      setMensagem("Nenhuma chave cadastrada no catálogo.");
      setCarregando(false);
      return;
    }

    const chaveEncontrada = data[0];
    setResultado(chaveEncontrada);

    await supabase.from("searches").insert({
      user_id: user.id,
      foto_cliente_url: fotoClienteUrl || "sem-foto",
      resultado_chave_id: chaveEncontrada.id,
      confianca: 75,
      status_confirmacao: "pending",
      chave_corrigida_id: null,
    });

    setMensagem("1 resultado encontrado com sucesso.");
    setCarregando(false);
  }

  return (
    <AppShell
      title="Buscar chave"
      subtitle="Procure a cópia certa para a chave do cliente"
    >
      <form
        onSubmit={handleBuscar}
        className="space-y-4 rounded-3xl bg-white p-4 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            URL da foto da chave do cliente
          </label>
          <input
            value={fotoClienteUrl}
            onChange={(e) => setFotoClienteUrl(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
            placeholder="Cole uma URL de imagem para teste"
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
          {carregando ? "Buscando..." : "Buscar chave"}
        </button>
      </form>

      {resultado && (
        <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-teal-700">
            Resultado final encontrado
          </p>

          <div className="mb-3 overflow-hidden rounded-2xl bg-slate-100">
            <img
              src={
                resultado.foto_url && resultado.foto_url !== "sem-foto"
                  ? resultado.foto_url
                  : "https://placehold.co/600x400/png?text=Sem+Foto"
              }
              alt={resultado.nome_modelo}
              className="h-44 w-full object-cover"
            />
          </div>

          <h2 className="text-base font-semibold text-slate-800">
            {resultado.nome_modelo}
          </h2>

          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>Marca: {resultado.marca || "-"}</p>
            <p>Categoria: {resultado.categoria || "-"}</p>
            <p>Etiqueta: {resultado.etiqueta || "-"}</p>
            <p>Localização: {resultado.localizacao || "-"}</p>
            <p>Observações: {resultado.observacoes || "-"}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default SearchKeyPage;
