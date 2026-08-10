import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { ContentCard, EmptyState, ErrorState, SectionHeader, SkeletonCard, StatusBadge } from "../shared/ui/premium";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminStore } from "../types/api";

export function AdminStoreDetailsPage() {
  const { storeId } = useParams();
  const { token } = useAuth();
  const [store, setStore] = useState<AdminStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStore() {
      if (!token || !storeId) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setStore(await adminService.getStore(token, storeId));
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Nao foi possivel carregar a empresa."));
      } finally {
        setIsLoading(false);
      }
    }

    void loadStore();
  }, [storeId, token]);

  if (isLoading) {
    return (
      <section className="page-section">
        <SkeletonCard lines={6} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-section">
        <ErrorState message={error} />
      </section>
    );
  }

  if (!store) {
    return (
      <section className="page-section">
        <EmptyState title="Empresa nao encontrada" />
      </section>
    );
  }

  return (
    <section className="page-section">
      <PageHeader
        action={<Link className="secondary-button" to="/admin/stores">Voltar</Link>}
        title={store.name}
        description="Detalhes operacionais, ultimos pedidos e historico administrativo seguro."
      />

      <div className="dashboard-metric-grid">
        <Metric title="Produtos" value={store._count?.products ?? 0} />
        <Metric title="Pedidos" value={store._count?.orders ?? 0} />
        <Metric title="Motoboys vinculados" value={store._count?.courierLinks ?? 0} />
        <Metric title="Taxas por bairro" value={store._count?.deliveryZones ?? 0} />
      </div>

      <div className="dashboard-bottom-grid">
        <ContentCard>
          <SectionHeader kicker="Empresa" title="Informacoes" />
          <div className="summary-grid">
            <div>
              <span className="info-label">Status</span>
              <StatusBadge tone={statusTone(store.status)}>{statusLabel(store.status)}</StatusBadge>
            </div>
            <div>
              <span className="info-label">ID publico</span>
              <strong>{store.id}</strong>
            </div>
            <div>
              <span className="info-label">Dono</span>
              <strong>{store.owner?.name ?? "Nao informado"}</strong>
              <p>{store.owner?.email}</p>
            </div>
            <div>
              <span className="info-label">Endereco</span>
              <strong>{store.address || "Nao informado"}</strong>
            </div>
            <div>
              <span className="info-label">Loja online</span>
              <strong>{store.storefrontEnabled ? "Ativa" : "Pausada"}</strong>
            </div>
            <div>
              <span className="info-label">Cadastro</span>
              <strong>{formatDateTime(store.createdAt)}</strong>
            </div>
          </div>
        </ContentCard>

        <ContentCard>
          <SectionHeader kicker="Pedidos" title="Ultimos pedidos" />
          {store.recentOrders?.length ? (
            <div className="dashboard-list">
              {store.recentOrders.map((order) => (
                <article className="dashboard-list-row" key={order.id}>
                  <div>
                    <strong>{order.customerName || "Cliente nao informado"}</strong>
                    <p>{order.id}</p>
                  </div>
                  <div className="dashboard-list-meta">
                    <StatusBadge tone={order.status === "CANCELLED" ? "danger" : "info"}>
                      {order.status}
                    </StatusBadge>
                    <strong>{formatCurrency(order.total ?? 0)}</strong>
                    <small>{formatDateTime(order.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum pedido recente" />
          )}
        </ContentCard>

        <ContentCard>
          <SectionHeader kicker="Auditoria" title="Historico administrativo" />
          {store.auditLogs?.length ? (
            <div className="dashboard-list">
              {store.auditLogs.map((log) => (
                <article className="dashboard-list-row" key={log.id}>
                  <div>
                    <strong>{formatAdminAction(log.action)}</strong>
                    <p>{log.reason || "Sem motivo informado"}</p>
                  </div>
                  <div className="dashboard-list-meta">
                    <small>{log.adminUser?.email ?? "admin"}</small>
                    <small>{formatDateTime(log.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem historico administrativo" />
          )}
        </ContentCard>
      </div>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <ContentCard>
      <span className="info-label">{title}</span>
      <strong className="premium-metric-value">{value}</strong>
    </ContentCard>
  );
}

function statusTone(status: AdminStore["status"]) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "SUSPENDED") {
    return "warning";
  }

  return "neutral";
}

function statusLabel(status: AdminStore["status"]) {
  if (status === "ACTIVE") {
    return "Ativa";
  }

  if (status === "SUSPENDED") {
    return "Suspensa";
  }

  return "Encerrada";
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

function formatAdminAction(action: string) {
  const labels: Record<string, string> = {
    STORE_SUSPENDED: "Empresa suspensa",
    STORE_ACTIVATED: "Empresa reativada",
    STORE_CLOSED: "Empresa encerrada",
    STORE_STATUS_CHANGED: "Status alterado",
    SUPER_ADMIN_LOGIN: "Login Super Admin"
  };

  return labels[action] ?? action;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
