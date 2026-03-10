import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { supabase } from "../lib/supabase";
import type { CatalogKey } from "../types/catalog";

function CatalogPage() {
  const navigate = useNavigate();
  const [chaves, setChaves] = useState<CatalogKey[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function carregarCatalogo() {
    setCarregando(true);
    setErro("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Usuário não encontrado.");
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from("catalog_keys")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setErro("Erro ao carregar catálogo.");
      setCarregando(false);
      return;
    }

    setChaves(data || []);
    setCarregando(false);
  }

  useEffect(() => {
    carregarCatalogo();
  }, []);

  async function handleExcluir(id: string) {
    const confirmar = window.confirm("Deseja excluir esta chave?");

    if (!confirmar) return;

    setExcluindoId(id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErro("Usuário não encontrado.");
      setExcluindoId(null);
      return;
    }

    const { error } = await supabase
      .from("catalog_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setErro("Erro ao excluir chave.");
      setExcluindoId(null);
      return;
    }

    setChaves((prev) => prev.filter((chave) => chave.id !== id));
    setExcluindoId(null);
  }

  return (
    <AppShell title="Catálogo" subtitle="Veja as chaves cadastradas no sistema">
      <div className="mb-4">
        <button
          onClick={() => navigate("/cadastrar-chave")}
          className="w-full rounded-3xl bg-teal-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          + Nova chave
        </button>
      </div>

      {carregando && (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Carregando catálogo...</p>
        </div>
      )}

      {erro && (
        <div className="mb-3 rounded-3xl bg-red-50 p-4 shadow-sm">
          <p className="text-sm text-red-600">{erro}</p>
        </div>
      )}

      {!carregando && !erro && chaves.length === 0 && (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Nenhuma chave cadastrada ainda.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {chaves.map((chave) => (
          <div key={chave.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="mb-3 overflow-hidden rounded-2xl bg-slate-100">
              {chave.foto_url && chave.foto_url !== "sem-foto" ? (
                <img
                  src={chave.foto_url}
                  alt={chave.nome_modelo}
                  className="h-44 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                  Sem foto
                </div>
              )}
            </div>

            <h2 className="text-base font-semibold text-slate-800">
              {chave.nome_modelo}
            </h2>

            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>Marca: {chave.marca || "-"}</p>
              <p>Categoria: {chave.categoria || "-"}</p>
              <p>Etiqueta: {chave.etiqueta || "-"}</p>
              <p>Localização: {chave.localizacao || "-"}</p>
              <p>Observações: {chave.observacoes || "-"}</p>
              <p className="break-all text-xs text-slate-400">
                Foto URL: {chave.foto_url || "-"}
              </p>
            </div>

            <div className="mt-4">
              <button
                onClick={() => handleExcluir(chave.id)}
                disabled={excluindoId === chave.id}
                className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {excluindoId === chave.id ? "Excluindo..." : "Excluir chave"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export default CatalogPage;
