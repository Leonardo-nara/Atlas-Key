import { useEffect, useState } from "react";

export function DesktopUpdateNotice() {
  const [state, setState] = useState<DesktopUpdateState>({ status: "idle" });
  const [dismissedVersion, setDismissedVersion] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const updates = window.desktopShell?.updates;
    if (!updates) return;
    let active = true;
    let receivedEvent = false;
    const unsubscribe = updates.subscribe((nextState) => {
      receivedEvent = true;
      if (active) setState(nextState);
    });
    void updates.getState().then((nextState) => {
      if (active && !receivedEvent) setState(nextState);
    }).catch(() => { /* Web/dev runs without a packaged updater. */ });
    return () => { active = false; unsubscribe(); };
  }, []);

  const updates = window.desktopShell?.updates;
  if (!updates || state.status === "idle" ||
      (dismissedVersion === state.version && state.status !== "downloading")) return null;

  async function perform(action: "download" | "install") {
    if (!updates || busy) return;
    setBusy(true);
    try { setState(await updates[action]()); }
    catch {
      setState((current) => ({ ...current, message: "Atualizacao indisponivel agora. Tente mais tarde." }));
    } finally { setBusy(false); }
  }

  return (
    <aside className="desktop-update-notice" aria-label="Atualizacao do MotoTake" aria-live="polite">
      <strong>
        {state.status === "ready" ? "Atualizacao pronta para instalar." :
          state.status === "downloading" ? `Baixando atualizacao... ${Math.round(state.percent ?? 0)}%` :
            state.status === "error" ? "Nao foi possivel baixar a atualizacao." :
              "Nova atualizacao do MotoTake disponivel."}
      </strong>
      <p>{state.message ?? (state.status === "ready" ? "Reinicie o MotoTake para concluir." :
        `Versao ${state.version}. Voce pode continuar usando o sistema normalmente.`)}</p>
      {state.status === "downloading" ? (
        <progress value={state.percent ?? 0} max={100} aria-label="Progresso do download" />
      ) : (
        <div className="desktop-update-actions">
          <button className="primary-button" disabled={busy} onClick={() => void perform(state.status === "ready" ? "install" : "download")}>
            {state.status === "ready" ? "Reiniciar e atualizar" : "Atualizar agora"}
          </button>
          <button className="secondary-button" disabled={busy} onClick={() => setDismissedVersion(state.version)}>Depois</button>
        </div>
      )}
    </aside>
  );
}
