import { useEffect, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import { storeCourierLinksService } from "../features/store-courier-links/store-courier-links-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { StoreCourierLink } from "../types/api";

function formatVehicle(link: StoreCourierLink) {
  const profile = link.courier.courierProfile;

  if (!profile?.vehicleType && !profile?.vehicleModel) {
    return "Veiculo nao informado";
  }

  return [profile.vehicleType, profile.vehicleModel].filter(Boolean).join(" - ");
}

export function CouriersPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<StoreCourierLink[]>([]);
  const [couriers, setCouriers] = useState<StoreCourierLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingLinkId, setActingLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadData();
  }, [token]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  async function loadData(options?: { silent?: boolean }) {
    if (!token) {
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const [nextRequests, nextCouriers] = await Promise.all([
        storeCourierLinksService.listRequests(token),
        storeCourierLinksService.listCouriers(token)
      ]);
      setRequests(nextRequests);
      setCouriers(nextCouriers);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar os motoboys da loja."
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function handleDecision(linkId: string, action: "approve" | "reject") {
    if (!token) {
      return;
    }

    setActingLinkId(linkId);
    setError(null);

    try {
      if (action === "approve") {
        await storeCourierLinksService.approve(token, linkId);
        setSuccessMessage("Solicitacao aprovada com sucesso.");
      } else {
        await storeCourierLinksService.reject(token, linkId);
        setSuccessMessage("Solicitacao rejeitada com sucesso.");
      }

      await loadData({ silent: true });
    } catch (actionError) {
      setError(
        actionError instanceof ApiError
          ? actionError.message
          : "Nao foi possivel atualizar a solicitacao."
      );
    } finally {
      setActingLinkId(null);
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Motoboys"
        description="Acompanhe solicitacoes de entrada e a base de motoboys aprovados da empresa."
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="screen-state">Carregando vinculos da loja...</div>
      ) : (
        <div className="couriers-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Solicitacoes pendentes</h3>
                <p className="muted-text">
                  Pedidos enviados por motoboys para participar da sua empresa.
                </p>
              </div>
              <span className="pill">{requests.length} pendente(s)</span>
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                Nenhuma solicitacao pendente no momento.
              </div>
            ) : (
              <div className="stack-list">
                {requests.map((link) => (
                  <article className="courier-card" key={link.id}>
                    <div className="courier-card-head">
                      <div>
                        <strong>{link.courier.name}</strong>
                        <p>{link.courier.email}</p>
                      </div>
                      <span className="pill">Pendente</span>
                    </div>

                    <div className="courier-card-grid">
                      <div>
                        <span className="info-label">Telefone</span>
                        <p>{link.courier.phone}</p>
                      </div>
                      <div>
                        <span className="info-label">Cidade</span>
                        <p>{link.courier.courierProfile?.city ?? "Nao informada"}</p>
                      </div>
                      <div>
                        <span className="info-label">Veiculo</span>
                        <p>{formatVehicle(link)}</p>
                      </div>
                      <div>
                        <span className="info-label">Placa</span>
                        <p>{link.courier.courierProfile?.plate ?? "Nao informada"}</p>
                      </div>
                    </div>

                    <p className="muted-text">
                      Solicitado em {new Date(link.createdAt).toLocaleString("pt-BR")}
                    </p>

                    <div className="row-actions">
                      <button
                        className="primary-button"
                        disabled={actingLinkId === link.id}
                        onClick={() => void handleDecision(link.id, "approve")}
                        type="button"
                      >
                        {actingLinkId === link.id ? "Processando..." : "Aprovar"}
                      </button>
                      <button
                        className="danger-button"
                        disabled={actingLinkId === link.id}
                        onClick={() => void handleDecision(link.id, "reject")}
                        type="button"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Motoboys vinculados</h3>
                <p className="muted-text">
                  Lista aprovada, pronta para a fase futura de pedidos multiempresa.
                </p>
              </div>
              <span className="pill">{couriers.length} aprovado(s)</span>
            </div>

            {couriers.length === 0 ? (
              <div className="empty-state">
                Nenhum motoboy aprovado ainda.
              </div>
            ) : (
              <div className="stack-list">
                {couriers.map((link) => (
                  <article className="courier-card courier-card-approved" key={link.id}>
                    <div className="courier-card-head">
                      <div>
                        <strong>{link.courier.name}</strong>
                        <p>{link.courier.email}</p>
                      </div>
                      <span className="pill">Aprovado</span>
                    </div>

                    <div className="courier-card-grid">
                      <div>
                        <span className="info-label">Telefone</span>
                        <p>{link.courier.phone}</p>
                      </div>
                      <div>
                        <span className="info-label">Cidade</span>
                        <p>{link.courier.courierProfile?.city ?? "Nao informada"}</p>
                      </div>
                      <div>
                        <span className="info-label">Veiculo</span>
                        <p>{formatVehicle(link)}</p>
                      </div>
                      <div>
                        <span className="info-label">Perfil</span>
                        <p>
                          {link.courier.profileCompleted
                            ? "Completo"
                            : "Cadastro ainda incompleto"}
                        </p>
                      </div>
                    </div>

                    <p className="muted-text">
                      Vinculado em{" "}
                      {link.approvedAt
                        ? new Date(link.approvedAt).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
