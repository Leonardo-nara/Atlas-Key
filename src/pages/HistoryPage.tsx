import AppShell from "../components/AppShell";

function HistoryPage() {
  return (
    <AppShell title="Histórico" subtitle="Consultas e resultados confirmados">
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Aqui vão aparecer as buscas feitas e os resultados salvos.
        </p>
      </div>
    </AppShell>
  );
}

export default HistoryPage;
