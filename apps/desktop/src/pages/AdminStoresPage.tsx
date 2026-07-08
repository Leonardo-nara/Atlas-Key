import { useEffect, useState, type FormEvent } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminStore, OperationalStatus } from "../types/api";

const statusOptions: OperationalStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

export function AdminStoresPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    store: AdminStore;
    status: OperationalStatus;
  } | null>(null);
  const [form, setForm] = useState({
    storeName: "",
    storeAddress: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: ""
  });

  useEffect(() => {
    void loadStores();
  }, [token]);

  async function loadStores() {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setStores(await adminService.listStores(token));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Nao foi possivel carregar empresas."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.createStore(token, form);
      setMessage("Empresa criada com dono inicial.");
      setForm({
        storeName: "",
        storeAddress: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        ownerPhone: ""
      });
      await loadStores();
    } catch (createError) {
      setError(getErrorMessage(createError, "Nao foi possivel criar a empresa."));
    }
  }

  async function handleStatusChange(storeId: string, status: OperationalStatus) {
    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.updateStoreStatus(token, storeId, status);
      setMessage("Status da empresa atualizado.");
      await loadStores();
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Nao foi possivel atualizar a empresa."));
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Empresas"
        description="Cadastre lojas, crie o dono inicial e controle suspensao ou inativacao sem apagar historico."
      />

      <form className="panel form-grid" onSubmit={(event) => void handleCreateStore(event)}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Nova empresa</span>
            <h2>Criar loja com dono</h2>
          </div>
        </div>

        <label>
          Nome da empresa
          <input
            onChange={(event) => setForm({ ...form, storeName: event.target.value })}
            required
            value={form.storeName}
          />
        </label>
        <label>
          Endereco
          <input
            onChange={(event) => setForm({ ...form, storeAddress: event.target.value })}
            required
            value={form.storeAddress}
          />
        </label>
        <label>
          Nome do dono
          <input
            onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
            required
            value={form.ownerName}
          />
        </label>
        <label>
          Email do dono
          <input
            onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
            required
            type="email"
            value={form.ownerEmail}
          />
        </label>
        <label>
          Senha inicial
          <input
            minLength={8}
            onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })}
            required
            type="password"
            value={form.ownerPassword}
          />
        </label>
        <label>
          Telefone
          <input
            onChange={(event) => setForm({ ...form, ownerPhone: event.target.value })}
            value={form.ownerPhone}
          />
        </label>
        <button className="primary-button" type="submit">
          Criar empresa
        </button>
      </form>

      {message ? <div className="feedback feedback-success">{message}</div> : null}
      {error ? <div className="feedback feedback-error">{error}</div> : null}

      <div className="panel data-table">
        {isLoading ? (
          <div className="screen-state state-loading">Carregando empresas...</div>
        ) : stores.length === 0 ? (
          <div className="empty-state">
            Nenhuma empresa cadastrada. Crie a primeira loja para iniciar a operação.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Dono</th>
                <th>Status</th>
                <th>Operacao</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <strong>{store.name}</strong>
                    <p>{store.address}</p>
                  </td>
                  <td>
                    <strong>{store.owner?.name ?? "Sem dono"}</strong>
                    <p>{store.owner?.email}</p>
                  </td>
                  <td>{statusLabel(store.status)}</td>
                  <td>
                    <select
                      onChange={(event) =>
                        setPendingStatusChange({
                          store,
                          status: event.target.value as OperationalStatus
                        })
                      }
                      value={store.status}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>
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
          description={`A empresa "${pendingStatusChange.store.name}" ficará como ${statusLabel(pendingStatusChange.status).toLowerCase()}. Isso pode bloquear operações da loja e ocultá-la para clientes.`}
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={() => {
            const nextChange = pendingStatusChange;
            setPendingStatusChange(null);
            void handleStatusChange(nextChange.store.id, nextChange.status);
          }}
          title="Alterar status da empresa?"
          tone={pendingStatusChange.status === "ACTIVE" ? "warning" : "danger"}
        />
      ) : null}
    </section>
  );
}

function statusLabel(status: OperationalStatus) {
  if (status === "ACTIVE") {
    return "Ativa";
  }

  if (status === "SUSPENDED") {
    return "Suspensa";
  }

  return "Inativa";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
