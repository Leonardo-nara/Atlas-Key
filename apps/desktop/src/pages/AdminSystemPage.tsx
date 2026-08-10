import { useEffect, useState } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { ContentCard, EmptyState, ErrorState, SectionHeader, SkeletonCard, StatusBadge } from "../shared/ui/premium";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminSystemHealth } from "../types/api";

export function AdminSystemPage() {
  const { token } = useAuth();
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      if (!token) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const nextHealth = await adminService.getSystemHealth(token);

        if (active) {
          setHealth(nextHealth);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError, "Nao foi possivel verificar a saude do sistema."));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadHealth();
    const interval = window.setInterval(() => void loadHealth(), 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token]);

  return (
    <section className="page-section">
      <PageHeader
        action={
          <button className="secondary-button" onClick={() => window.location.reload()} type="button">
            Verificar agora
          </button>
        }
        title="Sistema"
        description="Visao segura e resumida da saude operacional da plataforma."
      />

      {isLoading ? (
        <div className="dashboard-metric-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} lines={3} />
          ))}
        </div>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && health ? (
        <>
          <div className="dashboard-metric-grid">
            {health.services.map((service) => (
              <ContentCard key={service.key}>
                <SectionHeader
                  kicker="Monitoramento"
                  title={service.label}
                  description={service.detail}
                />
                <StatusBadge tone={statusTone(service.status)}>
                  {statusLabel(service.status)}
                </StatusBadge>
              </ContentCard>
            ))}
          </div>
          <ContentCard>
            <SectionHeader
              kicker="Ambiente"
              title="Resumo tecnico"
              description="Sem secrets, URLs privadas ou stack traces."
            />
            <div className="summary-grid">
              <div>
                <span className="info-label">Release/build</span>
                <strong>{health.release}</strong>
              </div>
              <div>
                <span className="info-label">Uptime</span>
                <strong>{formatUptime(health.uptimeSeconds)}</strong>
              </div>
              <div>
                <span className="info-label">Ultima verificacao</span>
                <strong>{formatDateTime(health.checkedAt)}</strong>
              </div>
            </div>
          </ContentCard>
        </>
      ) : null}

      {!isLoading && !error && !health ? (
        <EmptyState title="Sem dados de saude" description="Tente verificar novamente em alguns instantes." />
      ) : null}
    </section>
  );
}

function statusTone(status: AdminSystemHealth["services"][number]["status"]) {
  if (status === "OPERATIONAL") {
    return "success";
  }

  if (status === "UNSTABLE" || status === "NO_DATA") {
    return "warning";
  }

  return "danger";
}

function statusLabel(status: AdminSystemHealth["services"][number]["status"]) {
  const labels = {
    OPERATIONAL: "Operacional",
    UNSTABLE: "Instavel",
    UNAVAILABLE: "Indisponivel",
    NO_DATA: "Sem dados"
  };

  return labels[status];
}

function formatUptime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}min`;
  }

  return `${minutes}min`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
