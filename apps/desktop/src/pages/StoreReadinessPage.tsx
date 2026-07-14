import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../features/auth/auth-context";
import { dashboardService } from "../features/dashboard/dashboard-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { StoreReadiness, StoreReadinessCategory } from "../types/api";

type ReadinessState =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "success"; data: StoreReadiness; error: null }
  | { status: "error"; data: null; error: string };

const categoryLabels: Record<StoreReadinessCategory, string> = {
  REQUIRED: "Obrigatorio",
  RECOMMENDED: "Recomendado",
  OPTIONAL: "Opcional"
};

const categoryOrder: StoreReadinessCategory[] = ["REQUIRED", "RECOMMENDED", "OPTIONAL"];

export function StoreReadinessPage() {
  const { token } = useAuth();
  const [state, setState] = useState<ReadinessState>({
    status: "idle",
    data: null,
    error: null
  });

  const loadReadiness = useCallback(async () => {
    if (!token) {
      return;
    }

    setState({ status: "loading", data: null, error: null });

    try {
      const readiness = await dashboardService.getStoreReadiness(token);
      setState({ status: "success", data: readiness, error: null });
    } catch (error) {
      setState({
        status: "error",
        data: null,
        error:
          error instanceof ApiError
            ? error.message
            : "Nao foi possivel carregar a configuracao inicial."
      });
    }
  }, [token]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  useEffect(() => {
    function handleFocus() {
      void loadReadiness();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadReadiness]);

  const groupedItems = useMemo(() => {
    if (!state.data) {
      return [];
    }

    return categoryOrder
      .map((category) => ({
        category,
        items: state.data.items.filter((item) => item.category === category)
      }))
      .filter((group) => group.items.length > 0);
  }, [state.data]);

  return (
    <section className="page-section">
      <PageHeader
        title="Configuracao inicial"
        description="Checklist operacional para preparar a loja antes do piloto com clientes."
        action={
          <button className="secondary-button" onClick={() => void loadReadiness()} type="button">
            Atualizar
          </button>
        }
      />

      {state.status === "loading" ? (
        <div className="screen-state state-loading">Carregando checklist...</div>
      ) : null}

      {state.status === "error" ? (
        <div className="feedback feedback-error">{state.error}</div>
      ) : null}

      {state.status === "success" ? (
        <div className="dashboard-stack">
          <section className="panel readiness-panel">
            <div className="readiness-summary">
              <div>
                <span className="section-kicker">Prontidao operacional</span>
                <h2>{state.data.ready ? "Empresa pronta para operar" : "Ainda existem pendencias"}</h2>
                <p className="muted-text">
                  {state.data.completedRequiredItems}/{state.data.totalRequiredItems} itens obrigatorios concluidos.
                  A loja so e considerada pronta quando todos os obrigatorios estiverem completos.
                </p>
              </div>
              <div className="readiness-score">
                <strong>{state.data.percentage}%</strong>
                <span>obrigatorios</span>
                <small>{state.data.overallPercentage}% geral</small>
              </div>
            </div>
            <div className="readiness-progress" aria-label={`Progresso obrigatorio ${state.data.percentage}%`}>
              <span style={{ width: `${state.data.percentage}%` }} />
            </div>
          </section>

          {groupedItems.map((group) => (
            <section className="panel readiness-list-panel" key={group.category}>
              <div className="panel-heading">
                <div>
                  <span className="info-label">{categoryLabels[group.category]}</span>
                  <h2>{getCategoryTitle(group.category)}</h2>
                </div>
              </div>

              <div className="readiness-checklist">
                {group.items.map((item) => (
                  <article
                    className={`readiness-check-item ${
                      item.completed ? "readiness-check-done" : "readiness-check-pending"
                    }`}
                    key={item.key}
                  >
                    <div className="readiness-check-icon" aria-hidden="true">
                      {item.completed ? "OK" : "!"}
                    </div>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <Link className="secondary-button" to={item.route}>
                      {item.actionLabel}
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getCategoryTitle(category: StoreReadinessCategory) {
  const titles: Record<StoreReadinessCategory, string> = {
    REQUIRED: "Itens necessarios para operar",
    RECOMMENDED: "Melhorias recomendadas para o piloto",
    OPTIONAL: "Itens opcionais"
  };

  return titles[category];
}
