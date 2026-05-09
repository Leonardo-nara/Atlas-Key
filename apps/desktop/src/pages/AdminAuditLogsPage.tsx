import { useEffect, useState, type FormEvent } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminAuditLog, PaginationMeta } from "../types/api";

const PAGE_LIMIT = 20;

export function AdminAuditLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    targetType: ""
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAuditLogs();
  }, [token, page, filters]);

  async function loadAuditLogs() {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await adminService.listAuditLogs(token, {
        page,
        limit: PAGE_LIMIT,
        action: filters.action,
        targetType: filters.targetType
      });
      setLogs(response.items);
      setMeta(response.meta);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Nao foi possivel carregar auditoria."));
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      action: draftFilters.action.trim(),
      targetType: draftFilters.targetType.trim()
    });
  }

  function handleClearFilters() {
    const emptyFilters = { action: "", targetType: "" };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Auditoria"
        description="Registro operacional das acoes criticas feitas por administradores da plataforma."
      />

      <form className="panel audit-filter-panel" onSubmit={handleApplyFilters}>
        <label>
          Filtrar por acao
          <input
            onChange={(event) =>
              setDraftFilters({ ...draftFilters, action: event.target.value })
            }
            placeholder="Ex.: STORE_SUSPENDED"
            value={draftFilters.action}
          />
        </label>
        <label>
          Filtrar por alvo
          <input
            onChange={(event) =>
              setDraftFilters({ ...draftFilters, targetType: event.target.value })
            }
            placeholder="Ex.: STORE, USER, COURIER"
            value={draftFilters.targetType}
          />
        </label>
        <div className="audit-filter-actions">
          <button className="primary-button" type="submit">
            Filtrar
          </button>
          <button className="ghost-button" onClick={handleClearFilters} type="button">
            Limpar
          </button>
        </div>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel data-table">
        {isLoading ? (
          <div className="screen-state">Carregando logs de auditoria...</div>
        ) : logs.length === 0 ? (
          <div className="screen-state">Nenhum log encontrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Admin</th>
                <th>Acao</th>
                <th>Alvo</th>
                <th>Motivo</th>
                <th>Metadados</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <strong>{log.adminUser?.name ?? "Admin"}</strong>
                    <p>{log.adminUser?.email ?? log.adminUserId}</p>
                  </td>
                  <td>{actionLabel(log.action)}</td>
                  <td>
                    <strong>{log.targetType}</strong>
                    <p>{log.targetId}</p>
                  </td>
                  <td>{log.reason || "Sem motivo informado"}</td>
                  <td>
                    <code className="metadata-preview">
                      {summarizeMetadata(log.metadataJson)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination-row">
        <button
          className="ghost-button"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          type="button"
        >
          Anterior
        </button>
        <span>
          Pagina {meta?.page ?? page} de {meta?.totalPages ?? 1}
        </span>
        <button
          className="ghost-button"
          disabled={isLoading || page >= (meta?.totalPages ?? 1)}
          onClick={() => setPage((currentPage) => currentPage + 1)}
          type="button"
        >
          Proxima
        </button>
      </div>
    </section>
  );
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    STORE_SUSPENDED: "Empresa suspensa",
    STORE_ACTIVATED: "Empresa ativada",
    STORE_INACTIVATED: "Empresa inativada",
    USER_SUSPENDED: "Usuario suspenso",
    USER_ACTIVATED: "Usuario ativado",
    USER_INACTIVATED: "Usuario inativado",
    COURIER_SUSPENDED: "Motoboy suspenso",
    COURIER_ACTIVATED: "Motoboy ativado",
    COURIER_INACTIVATED: "Motoboy inativado",
    COURIER_LINK_BLOCKED: "Vinculo de motoboy bloqueado"
  };

  return labels[action] ?? action;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function summarizeMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "Sem metadados";
  }

  const sanitizedEntries = Object.entries(metadata)
    .filter(([key]) => !isSensitiveKey(key))
    .slice(0, 6);

  if (sanitizedEntries.length === 0) {
    return "Metadados ocultos";
  }

  return sanitizedEntries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

function isSensitiveKey(key: string) {
  return /password|senha|token|secret|pixKey|arquivo|base64/i.test(key);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
