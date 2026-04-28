import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";

const navigationItems = [
  { to: "/", label: "Visao geral", end: true },
  { to: "/products", label: "Produtos" },
  { to: "/orders", label: "Pedidos" },
  { to: "/couriers", label: "Motoboys" },
  { to: "/delivery-zones", label: "Taxas por bairro" },
  { to: "/pix-settings", label: "Pix manual" }
];

export function AppLayout() {
  const { user, store, logout, logoutAll } = useAuth();

  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="section-kicker">Painel empresarial</p>
          <h1>{store?.name ?? "Loja"}</h1>
          <p>{store?.address || "Complete o endereco da loja quando quiser."}</p>
        </div>

        <div className="sidebar-section">
          <span className="user-chip">Operacao da loja</span>
          <p>
            Acompanhe pedidos, catalogo e vinculos com um painel mais claro para
            a rotina da empresa.
          </p>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-item nav-item-active" : "nav-item"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <span className="user-chip">Sessao ativa</span>
            <p>
              <strong>{user?.name}</strong>
            </p>
            <p>{user?.email}</p>
          </div>

          <div className="sidebar-actions">
            <button className="ghost-button" onClick={logout} type="button">
              Sair
            </button>
            <button className="ghost-button" onClick={logoutAll} type="button">
              Sair de todos
            </button>
          </div>
        </div>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
