import { useEffect, useState, type FormEvent } from "react";

import { adminService } from "../features/admin/admin-service";
import { useAuth } from "../features/auth/auth-context";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { AdminUser, OperationalStatus } from "../types/api";

const statusOptions: OperationalStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];
const roleOptions: AdminUser["role"][] = ["PLATFORM_ADMIN", "CLIENT", "COURIER"];

export function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "CLIENT" as AdminUser["role"]
  });

  useEffect(() => {
    void loadUsers();
  }, [token]);

  async function loadUsers() {
    if (!token) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setUsers(await adminService.listUsers(token));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Nao foi possivel carregar usuarios."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.createUser(token, form);
      setMessage("Usuario criado com sucesso.");
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "CLIENT"
      });
      await loadUsers();
    } catch (createError) {
      setError(getErrorMessage(createError, "Nao foi possivel criar o usuario."));
    }
  }

  async function handleStatusChange(userId: string, status: OperationalStatus) {
    if (!token) {
      return;
    }

    try {
      setMessage(null);
      setError(null);
      await adminService.updateUserStatus(token, userId, status);
      setMessage("Status do usuario atualizado.");
      await loadUsers();
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Nao foi possivel atualizar o usuario."));
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Usuarios"
        description="Controle contas de suporte, clientes e motoboys sem expor senha ou hash."
      />

      <form className="panel form-grid" onSubmit={(event) => void handleCreateUser(event)}>
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Novo usuario</span>
            <h2>Criar acesso basico</h2>
          </div>
        </div>
        <label>
          Nome
          <input
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
        </label>
        <label>
          Email
          <input
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
            type="email"
            value={form.email}
          />
        </label>
        <label>
          Senha inicial
          <input
            minLength={8}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
            type="password"
            value={form.password}
          />
        </label>
        <label>
          Telefone
          <input
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            value={form.phone}
          />
        </label>
        <label>
          Perfil
          <select
            onChange={(event) =>
              setForm({ ...form, role: event.target.value as AdminUser["role"] })
            }
            value={form.role}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit">
          Criar usuario
        </button>
      </form>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel data-table">
        {isLoading ? (
          <div className="screen-state">Carregando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="screen-state">Nenhum usuario cadastrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Operacao</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <p>{user.email}</p>
                  </td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{statusLabel(user.status)}</td>
                  <td>
                    <select
                      onChange={(event) =>
                        void handleStatusChange(
                          user.id,
                          event.target.value as OperationalStatus
                        )
                      }
                      value={user.status}
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

function roleLabel(role: AdminUser["role"]) {
  if (role === "PLATFORM_ADMIN") {
    return "Admin da plataforma";
  }

  if (role === "STORE_ADMIN") {
    return "Dono de loja";
  }

  if (role === "COURIER") {
    return "Motoboy";
  }

  return "Cliente";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
