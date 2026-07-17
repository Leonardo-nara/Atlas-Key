import { useState } from "react";

import { useDesktopUpdates } from "../features/updates/useDesktopUpdates";
import { PageHeader } from "../shared/ui/PageHeader";

export function SettingsPage() {
  const {
    isDesktop,
    appInfo,
    updateState,
    lastCheckedAt,
    checkForUpdates,
    installUpdate
  } = useDesktopUpdates();
  const [checkingManually, setCheckingManually] = useState(false);

  async function handleCheck() {
    setCheckingManually(true);

    try {
      await checkForUpdates();
    } finally {
      setCheckingManually(false);
    }
  }

  return (
    <section className="page-section settings-page">
      <PageHeader
        title="Configurações"
        description="Acompanhe informações do aplicativo instalado e mantenha o Mototake atualizado."
      />

      {isDesktop ? (
        <section className="panel update-settings-card">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Sobre e atualizações</p>
              <h3>Mototake Desktop</h3>
            </div>
            <span className="pill">Canal Estável</span>
          </div>

          <div className="update-status-grid">
            <article className="info-card">
              <span className="info-label">Versão instalada</span>
              <strong>{appInfo?.version ?? "Carregando..."}</strong>
            </article>
            <article className="info-card">
              <span className="info-label">Situação</span>
              <strong>{updateStatusLabel(updateState)}</strong>
            </article>
            <article className="info-card">
              <span className="info-label">Última verificação</span>
              <strong>{lastCheckedAt ? formatDateTime(lastCheckedAt) : "Ainda não verificado"}</strong>
            </article>
          </div>

          {updateState.status === "downloading" ? (
            <div className="update-progress-card">
              <div className="report-line">
                <span>Baixando atualização — {Math.round(updateState.percent)}%</span>
                <strong>
                  {formatBytes(updateState.transferred)} de {formatBytes(updateState.total)}
                </strong>
              </div>
              <div className="report-bar-track">
                <span style={{ width: `${Math.max(0, Math.min(100, updateState.percent))}%` }} />
              </div>
            </div>
          ) : null}

          {updateState.status === "downloaded" ? (
            <div className="feedback feedback-success">
              A versão {updateState.version} foi baixada e está pronta para instalação.
            </div>
          ) : null}

          {updateState.status === "available" ? (
            <div className="feedback feedback-info">
              Nova versão disponível: {updateState.version}. O download será feito em segundo plano.
            </div>
          ) : null}

          {updateState.status === "error" ? (
            <div className="feedback feedback-warning">
              Não foi possível verificar atualizações. {updateState.message}
            </div>
          ) : null}

          <div className="row-actions">
            <button
              className="secondary-button"
              disabled={checkingManually || updateState.status === "checking" || updateState.status === "downloading"}
              onClick={() => void handleCheck()}
              type="button"
            >
              {checkingManually || updateState.status === "checking" ? "Verificando atualizações..." : "Verificar atualizações"}
            </button>
            {updateState.status === "downloaded" ? (
              <button className="primary-button" onClick={() => void installUpdate()} type="button">
                Atualizar e reiniciar
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="empty-state">
          As atualizações automáticas ficam disponíveis apenas no aplicativo desktop instalado.
        </div>
      )}
    </section>
  );
}

function updateStatusLabel(state: UpdateState) {
  switch (state.status) {
    case "checking":
      return "Verificando atualizações...";
    case "available":
      return "Nova versão disponível";
    case "downloading":
      return `Baixando atualização — ${Math.round(state.percent)}%`;
    case "downloaded":
      return "Atualização pronta";
    case "not-available":
      return "Mototake atualizado";
    case "error":
      return "Não foi possível verificar atualizações";
    default:
      return "Mototake atualizado";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 MB";
  }

  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1024 / 1024)} MB`;
}

