import { useAuth } from "../features/auth/auth-context";
import { PageHeader } from "../shared/ui/PageHeader";

export function DashboardPage() {
  const { user, store } = useAuth();
  const roleLabel =
    user?.role === "STORE_ADMIN" ? "Administrador da loja" : "Motoboy";

  return (
    <section className="page-section">
      <PageHeader
        title="Visao geral"
        description="Resumo inicial da operacao da loja autenticada, com foco rapido no acompanhamento do dia a dia."
      />

      <div className="info-grid">
        <article className="info-card">
          <span className="info-label">Loja</span>
          <strong>{store?.name}</strong>
          <p>{store?.address}</p>
          <p>{store?.active ? "Loja pronta para operar" : "Loja inativa"}</p>
        </article>
        <article className="info-card">
          <span className="info-label">Usuario</span>
          <strong>{user?.name}</strong>
          <p>{user?.email}</p>
        </article>
        <article className="info-card">
          <span className="info-label">Perfil</span>
          <strong>{roleLabel}</strong>
          <p>{user?.active ? "Conta ativa" : "Conta inativa"}</p>
        </article>
        <article className="info-card">
          <span className="info-label">Operacao</span>
          <strong>Painel preparado</strong>
          <p>
            Use o desktop para criar e acompanhar pedidos e o mobile para a
            execucao das entregas.
          </p>
        </article>
      </div>
    </section>
  );
}
