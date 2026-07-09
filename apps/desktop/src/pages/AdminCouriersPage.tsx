import { useEffect, useMemo, useState } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminCourier, OperationalStatus } from "../types/api";

const statusOptions: OperationalStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

export function AdminCouriersPage() {
  const { token } = useAuth();
  const [couriers, setCouriers] = useState<AdminCourier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | "ALL">("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    courier: AdminCourier;
    status: OperationalStatus;
  } | null>(null);
  const [pendingLinkBlock, setPendingLinkBlock] = useState<{
    courier: AdminCourier;
    linkId: string;
    storeName: string;
  } | null>(null);

  useEffect(() => {
    void loadCouriers();
  }, [token]);

  const displayedCouriers = useMemo(() => {
    const normalizedSearch = normalizeSearch(search);

    return [...couriers]
      .sort((firstCourier, secondCourier) =>
        firstCourier.name.localeCompare(secondCourier.name, "pt-BR")
      )
      .filter((courier) => {
        if (statusFilter !== "ALL" && courier.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return normalizeSearch(
          [
            courier.name,
            courier.email,
            courier.phone,
            courier.courierProfile?.city,
            courier.courierProfile?.vehicleModel,
            courier.storeLinks?.map((link) => link.store.name).join(" ")
          ].join(" ")
        ).includes(normalizedSearch);
      });
  }, [couriers, search, statusFilter]);

  async function loadCouriers() {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setCouriers(await adminService.listCouriers(token));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Nao foi possivel carregar motoboys."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(courierId: string, status: OperationalStatus) {
    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.updateCourierStatus(token, courierId, status);
      setMessage("Status do motoboy atualizado.");
      await loadCouriers();
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Nao foi possivel atualizar o motoboy."));
    }
  }

  async function handleBlockLink(courierId: string, linkId: string) {
    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.blockCourierLink(token, courierId, linkId);
      setMessage("Vinculo bloqueado com seguranca.");
      await loadCouriers();
    } catch (linkError) {
      setError(getErrorMessage(linkError, "Nao foi possivel bloquear o vinculo."));
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Motoboys"
        description="Acompanhe perfis, status e vinculos operacionais dos motoboys."
      />

      {message ? <div className="feedback feedback-success">{message}</div> : null}
      {error ? <div className="feedback feedback-error">{error}</div> : null}

      <div className="panel data-table">
        <div className="operation-filter-panel">
          <label className="field">
            <span>Pesquisar motoboy</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, email, cidade ou empresa"
              value={search}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              onChange={(event) =>
                setStatusFilter(event.target.value as OperationalStatus | "ALL")
              }
              value={statusFilter}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="SUSPENDED">Suspensos</option>
              <option value="INACTIVE">Inativos</option>
            </select>
          </label>
        </div>
        {isLoading ? (
          <div className="screen-state state-loading">Carregando motoboys...</div>
        ) : couriers.length === 0 ? (
          <div className="empty-state">
            Nenhum motoboy cadastrado ainda. Quando houver cadastros, eles aparecerão aqui.
          </div>
        ) : displayedCouriers.length === 0 ? (
          <div className="empty-state">
            Nenhum motoboy encontrado para os filtros selecionados.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Motoboy</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Vinculos</th>
              </tr>
            </thead>
            <tbody>
              {displayedCouriers.map((courier) => (
                <tr key={courier.id}>
                  <td>
                    <strong>{courier.name}</strong>
                    <p>{courier.email}</p>
                  </td>
                  <td>
                    <p>{courier.courierProfile?.city ?? "Cidade nao informada"}</p>
                    <p>{courier.courierProfile?.vehicleModel ?? "Veiculo nao informado"}</p>
                  </td>
                  <td>
                    <select
                      onChange={(event) =>
                        setPendingStatusChange({
                          courier,
                          status: event.target.value as OperationalStatus
                        })
                      }
                      value={courier.status}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {courier.storeLinks?.length ? (
                      <div className="stack-list compact-list">
                        {courier.storeLinks.map((link) => (
                          <div className="inline-action-row" key={link.id}>
                            <span>
                              {link.store.name} - {linkStatusLabel(link.status)}
                            </span>
                            {link.status !== "BLOCKED" ? (
                              <button
                                className="ghost-button"
                                onClick={() =>
                                  setPendingLinkBlock({
                                    courier,
                                    linkId: link.id,
                                    storeName: link.store.name
                                  })
                                }
                                type="button"
                              >
                                Bloquear vinculo
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>Sem vinculos</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingStatusChange ? (
        <ConfirmDialog
          confirmLabel={`Alterar para ${statusLabel(pendingStatusChange.status)}`}
          description={`O motoboy "${pendingStatusChange.courier.name}" ficará como ${statusLabel(pendingStatusChange.status).toLowerCase()}. Se for suspenso ou inativado, ele não poderá operar entregas.`}
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={() => {
            const nextChange = pendingStatusChange;
            setPendingStatusChange(null);
            void handleStatusChange(nextChange.courier.id, nextChange.status);
          }}
          title="Alterar status do motoboy?"
          tone={pendingStatusChange.status === "ACTIVE" ? "warning" : "danger"}
        />
      ) : null}

      {pendingLinkBlock ? (
        <ConfirmDialog
          confirmLabel="Bloquear vínculo"
          description={`O vínculo de "${pendingLinkBlock.courier.name}" com "${pendingLinkBlock.storeName}" será bloqueado. O motoboy deixará de operar por essa empresa.`}
          onCancel={() => setPendingLinkBlock(null)}
          onConfirm={() => {
            const nextBlock = pendingLinkBlock;
            setPendingLinkBlock(null);
            void handleBlockLink(nextBlock.courier.id, nextBlock.linkId);
          }}
          title="Bloquear vínculo do motoboy?"
          tone="danger"
        />
      ) : null}
    </section>
  );
}

function statusLabel(status: OperationalStatus) {
  if (status === "ACTIVE") {
    return "Ativo";
  }

  if (status === "SUSPENDED") {
    return "Suspenso";
  }

  return "Inativo";
}

function linkStatusLabel(status: string) {
  if (status === "APPROVED") {
    return "Aprovado";
  }

  if (status === "PENDING") {
    return "Pendente";
  }

  if (status === "REJECTED") {
    return "Rejeitado";
  }

  return "Bloqueado";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
