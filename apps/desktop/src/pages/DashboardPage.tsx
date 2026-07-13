import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { dashboardService } from "../features/dashboard/dashboard-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminDashboard, StoreDashboard } from "../types/api";
import { useAuth } from "../features/auth/auth-context";

type DashboardState =
  | { status: "idle" | "loading"; store: null; admin: null; error: null }
  | { status: "success"; store: StoreDashboard | null; admin: AdminDashboard | null; error: null }
  | { status: "error"; store: null; admin: null; error: string };

export function DashboardPage() {
  const { token, user, store } = useAuth();
  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";
  const [state, setState] = useState<DashboardState>({
    status: "idle",
    store: null,
    admin: null,
    error: null
  });

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const currentToken = token;
    const currentUser = user;
    let isActive = true;
    setState({ status: "loading", store: null, admin: null, error: null });

    async function loadDashboard() {
      try {
        if (currentUser.role === "PLATFORM_ADMIN") {
          const adminDashboard = await dashboardService.getAdminDashboard(currentToken);

          if (isActive) {
            setState({
              status: "success",
              store: null,
              admin: adminDashboard,
              error: null
            });
          }

          return;
        }

        if (currentUser.role === "STORE_ADMIN") {
          const storeDashboard = await dashboardService.getStoreDashboard(currentToken);

          if (isActive) {
            setState({
              status: "success",
              store: storeDashboard,
              admin: null,
              error: null
            });
          }
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          store: null,
          admin: null,
          error:
            error instanceof ApiError
              ? error.message
              : "Nao foi possivel carregar os indicadores."
        });
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [token, user]);

  return (
    <section className="page-section">
      <PageHeader
        title={isPlatformAdmin ? "Visao geral da plataforma" : "Visao geral da loja"}
        description={
          isPlatformAdmin
            ? "Indicadores operacionais para acompanhar empresas, usuarios e pedidos do piloto."
            : `Resumo rapido da operacao ${store?.name ? `da ${store.name}` : "da loja"}.`
        }
      />

      {state.status === "loading" ? (
        <div className="screen-state state-loading">Carregando indicadores...</div>
      ) : null}

      {state.status === "error" ? (
        <div className="feedback feedback-error">{state.error}</div>
      ) : null}

      {state.status === "success" && state.store ? (
        <StoreDashboardView dashboard={state.store} />
      ) : null}

      {state.status === "success" && state.admin ? (
        <AdminDashboardView dashboard={state.admin} />
      ) : null}
    </section>
  );
}

function StoreDashboardView({ dashboard }: { dashboard: StoreDashboard }) {
  return (
    <div className="dashboard-stack">
      <div className="info-grid">
        <MetricCard label="Pedidos hoje" value={dashboard.ordersToday} />
        <MetricCard label="Pendentes" value={dashboard.pendingOrders} />
        <MetricCard label="Em andamento" value={dashboard.inProgressOrders} />
        <MetricCard label="Entregues hoje" value={dashboard.deliveredToday} />
        <MetricCard
          label="Faturamento estimado hoje"
          value={formatCurrency(dashboard.estimatedRevenueToday)}
          tone="primary"
        />
        <MetricCard label="Pagamentos pendentes" value={dashboard.pendingPayments} />
        <MetricCard label="Produtos ativos" value={dashboard.activeProducts} />
        <MetricCard label="Motoboys ativos" value={dashboard.activeCouriers} />
        <MetricCard label="Estoque baixo" value={dashboard.lowStockProducts} />
        <MetricCard label="Sem estoque" value={dashboard.outOfStockProducts} />
      </div>

      <p className="dashboard-updated-at">
        Atualizado em {formatDateTime(dashboard.generatedAt)}
      </p>
      <Link className="secondary-button dashboard-report-link" to="/reports">
        Ver relatórios
      </Link>
    </div>
  );
}

function AdminDashboardView({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <div className="dashboard-stack">
      <div className="info-grid">
        <MetricCard label="Empresas ativas" value={dashboard.activeStores} tone="primary" />
        <MetricCard label="Empresas suspensas" value={dashboard.suspendedStores} />
        <MetricCard label="Empresas inativas" value={dashboard.inactiveStores} />
        <MetricCard label="Usuarios ativos" value={dashboard.activeUsers} />
        <MetricCard label="Motoboys ativos" value={dashboard.activeCouriers} />
        <MetricCard label="Pedidos hoje" value={dashboard.ordersToday} />
        <MetricCard label="Pedidos totais" value={dashboard.totalOrders} />
        <MetricCard label="Pagamentos pendentes" value={dashboard.pendingPayments} />
      </div>

      <section className="panel dashboard-panel">
        <div className="panel-heading">
          <div>
            <span className="info-label">Empresas recentes</span>
            <h2>Ultimas empresas cadastradas</h2>
          </div>
        </div>

        {dashboard.recentStores.length === 0 ? (
          <div className="empty-state">Nenhuma empresa cadastrada recentemente.</div>
        ) : (
          <div className="dashboard-recent-list">
            {dashboard.recentStores.map((recentStore) => (
              <article className="dashboard-recent-row" key={recentStore.id}>
                <div>
                  <strong>{recentStore.name}</strong>
                  <p>
                    Dono: {recentStore.owner?.name ?? "Nao informado"} -{" "}
                    {recentStore.owner?.email ?? "sem email"}
                  </p>
                </div>
                <div className="dashboard-recent-meta">
                  <span className={`pill dashboard-status dashboard-status-${recentStore.status.toLowerCase()}`}>
                    {formatStatus(recentStore.status)}
                  </span>
                  <small>{formatDateTime(recentStore.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="dashboard-updated-at">
        Atualizado em {formatDateTime(dashboard.generatedAt)}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "primary";
}) {
  return (
    <article className={`info-card metric-card metric-card-${tone}`}>
      <span className="info-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatStatus(status: "ACTIVE" | "SUSPENDED" | "INACTIVE") {
  const labels = {
    ACTIVE: "Ativa",
    SUSPENDED: "Suspensa",
    INACTIVE: "Inativa"
  };

  return labels[status];
}
