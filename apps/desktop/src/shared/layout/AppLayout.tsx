import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";

const navigationItems = [
  { to: "/", label: "Visão geral", end: true },
  { to: "/products", label: "Produtos" },
  { to: "/orders", label: "Pedidos" },
  { to: "/couriers", label: "Motoboys" }
];

export function AppLayout() {
  const { user, store, logout } = useAuth();

  return (
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="section-kicker">Painel do lojista</p>
          <h1>{store?.name ?? "Loja"}</h1>
          <p>{store?.address ?? "Endereço indisponível"}</p>
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
            <strong>{user?.name}</strong>
            <p>{user?.email}</p>
          </div>
          <button className="ghost-button" onClick={logout} type="button">
            Sair
          </button>
        </div>
      </aside>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
