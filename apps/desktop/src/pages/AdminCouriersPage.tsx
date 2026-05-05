import { useEffect, useState } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminCourier, OperationalStatus } from "../types/api";

const statusOptions: OperationalStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

export function AdminCouriersPage() {
  const { token } = useAuth();
  const [couriers, setCouriers] = useState<AdminCourier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCouriers();
  }, [token]);

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

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel data-table">
        {isLoading ? (
          <div className="screen-state">Carregando motoboys...</div>
        ) : couriers.length === 0 ? (
          <div className="screen-state">Nenhum motoboy cadastrado.</div>
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
              {couriers.map((courier) => (
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
                        void handleStatusChange(
                          courier.id,
                          event.target.value as OperationalStatus
                        )
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
                                  void handleBlockLink(courier.id, link.id)
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
