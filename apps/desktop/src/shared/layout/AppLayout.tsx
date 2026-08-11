import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";
import { toMediaUrl } from "../../lib/media-url";
import { StatusBadge } from "../ui/premium";

const SIDEBAR_COLLAPSED_KEY = "mototake:sidebar-collapsed";

type NavIconName =
  | "dashboard"
  | "setup"
  | "orders"
  | "products"
  | "stock"
  | "storefront"
  | "pdv"
  | "cash"
  | "zones"
  | "pix"
  | "reports"
  | "couriers"
  | "adminStores"
  | "adminUsers"
  | "system"
  | "audit";

const navigationItems: Array<{ to: string; label: string; icon: NavIconName; end?: boolean }> = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/setup", label: "Configuracao inicial", icon: "setup" },
  { to: "/orders", label: "Pedidos", icon: "orders" },
  { to: "/products", label: "Produtos", icon: "products" },
  { to: "/stock", label: "Estoque", icon: "stock" },
  { to: "/storefront", label: "Loja online", icon: "storefront" },
  { to: "/pdv", label: "PDV", icon: "pdv" },
  { to: "/cash-registers", label: "Caixa", icon: "cash" },
  { to: "/delivery-zones", label: "Taxas de entrega", icon: "zones" },
  { to: "/pix-settings", label: "Pix manual", icon: "pix" },
  { to: "/reports", label: "Relatorios", icon: "reports" },
  { to: "/couriers", label: "Motoboys", icon: "couriers" }
];

const adminNavigationItems: Array<{ to: string; label: string; icon: NavIconName; end?: boolean }> = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/admin/stores", label: "Empresas", icon: "adminStores" },
  { to: "/admin/users", label: "Usuarios", icon: "adminUsers" },
  { to: "/admin/couriers", label: "Motoboys", icon: "couriers" },
  { to: "/admin/system", label: "Sistema", icon: "system" },
  { to: "/admin/audit-logs", label: "Auditoria", icon: "audit" }
];

export function AppLayout() {
  const { user, store, logout, logoutAll, uploadStoreImage, removeStoreImage } =
    useAuth();
  const [storeImageError, setStoreImageError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isPlatformAdmin = user?.role === "SUPER_ADMIN" || user?.role === "PLATFORM_ADMIN";
  const isStoreAdmin = user?.role === "STORE_ADMIN";
  const activeNavigationItems = isPlatformAdmin
    ? adminNavigationItems
    : isStoreAdmin
      ? navigationItems
      : [];
  const initials = isPlatformAdmin
    ? "A"
    : store?.name?.slice(0, 1).toUpperCase() ?? "L";
  const shellClasses = [
    "desktop-shell",
    sidebarCollapsed ? "desktop-shell-collapsed" : "",
    mobileSidebarOpen ? "desktop-shell-mobile-open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  async function handleStoreImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setStoreImageError(null);
      await uploadStoreImage(file);
    } catch {
      setStoreImageError("Nao foi possivel salvar a foto da loja.");
    }
  }

  async function handleRemoveStoreImage() {
    try {
      setStoreImageError(null);
      await removeStoreImage();
    } catch {
      setStoreImageError("Nao foi possivel remover a foto da loja.");
    }
  }

  return (
    <div className={shellClasses}>
      <button
        aria-label="Fechar menu"
        className="sidebar-scrim"
        onClick={() => setMobileSidebarOpen(false)}
        type="button"
      />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-row">
            <div className="brand-mark">M</div>
            <div className="brand-copy">
              <strong>Mototake</strong>
              <span>{isPlatformAdmin ? "Super Admin" : "Painel"}</span>
            </div>
            <button
              aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              className="sidebar-collapse-button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              type="button"
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>

          <div className="store-profile-card">
            <div className="store-avatar">
              {isPlatformAdmin ? (
                <span>A</span>
              ) : store?.imageUrl ? (
                <img
                  alt={`Imagem de ${store.name}`}
                  src={toMediaUrl(store.imageUrl) ?? undefined}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="store-profile-copy">
              <p className="section-kicker">
                {isPlatformAdmin ? "Administracao interna" : "Empresa"}
              </p>
              <h1>{isPlatformAdmin ? "Plataforma" : store?.name ?? "Loja"}</h1>
              <p>
                {isPlatformAdmin
                  ? "Controle seguro da plataforma."
                  : store?.address || "Endereco nao informado."}
              </p>
              <StatusBadge tone={store?.status === "SUSPENDED" ? "warning" : "success"}>
                {isPlatformAdmin
                  ? "Acesso restrito"
                  : store?.status === "SUSPENDED"
                    ? "Suspensa"
                    : "Ativa"}
              </StatusBadge>
            </div>
          </div>

          {isStoreAdmin ? (
            <div className="store-image-actions">
              <label className="sidebar-upload-button">
                Alterar foto
                <input
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleStoreImageChange(event)}
                  type="file"
                />
              </label>
              {store?.imageUrl ? (
                <button
                  className="sidebar-mini-button"
                  onClick={() => void handleRemoveStoreImage()}
                  type="button"
                >
                  Remover
                </button>
              ) : null}
            </div>
          ) : null}
          {storeImageError ? (
            <p className="sidebar-error-text">{storeImageError}</p>
          ) : null}
        </div>

        <div className="sidebar-section">
          <span className="user-chip">
            {isPlatformAdmin ? "Controle da plataforma" : "Operacao da loja"}
          </span>
          <p>
            {isPlatformAdmin
              ? "Empresas, usuarios, auditoria e saude operacional."
              : "Pedidos, catalogo, caixa e relatorios em uma rotina centralizada."}
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          {activeNavigationItems.length > 0 ? (
            activeNavigationItems.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  isActive ? "nav-item nav-item-active" : "nav-item"
                }
                end={item.end}
                key={item.to}
                onClick={() => setMobileSidebarOpen(false)}
                to={item.to}
              >
                <span className="nav-icon" aria-hidden="true">{renderNavIcon(item.icon)}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))
          ) : (
            <span className="nav-item">Acesso indisponivel</span>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
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
        <header className="topbar">
          <button
            aria-label="Abrir menu"
            className="topbar-menu-button"
            onClick={() => setMobileSidebarOpen(true)}
            type="button"
          >
            Menu
          </button>
          <div className="topbar-title">
            <p className="section-kicker">Painel operacional</p>
            <strong>{isPlatformAdmin ? "Super Admin Mototake" : store?.name ?? "Mototake"}</strong>
          </div>
          <div className="topbar-status">
            <span className="online-dot" aria-hidden="true" />
            <span>Sistema online</span>
          </div>
          <div className="topbar-user">
            <span>{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </div>
            <span className="topbar-user-caret" aria-hidden="true">⌄</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function renderNavIcon(icon: NavIconName) {
  const iconPaths: Record<NavIconName, string[]> = {
    dashboard: ["M3 11.5 12 4l9 7.5", "M5 10.5V20h5v-5h4v5h5v-9.5"],
    setup: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M4 12h2m12 0h2M12 4v2m0 12v2m5.7-13.7-1.4 1.4M7.7 16.3l-1.4 1.4m0-11.4 1.4 1.4m8.6 8.6 1.4 1.4"],
    orders: ["M7 4h10l2 4v12H5V8l2-4Z", "M8 9h8M8 13h8M8 17h5"],
    products: ["M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z", "M4.5 7.2 12 11.5l7.5-4.3M12 11.5V21"],
    stock: ["M5 7h14M6 11h12M7 15h10M8 19h8", "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"],
    storefront: ["M4 10h16l-1.2-5H5.2L4 10Z", "M6 10v10h12V10", "M9 20v-6h6v6"],
    pdv: ["M4 5h16v11H4V5Z", "M8 20h8M12 16v4"],
    cash: ["M4 7h16v12H4V7Z", "M8 7V5h8v2", "M7 12h10M8 16h3"],
    zones: ["M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11Z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    pix: ["M7 7 4 10l3 3M17 7l3 3-3 3M10 4l4 16"],
    reports: ["M6 4h12v16H6V4Z", "M9 15v2m3-6v6m3-9v9"],
    couriers: ["M8 17a4 4 0 0 1 8 0", "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M4 19h16"],
    adminStores: ["M4 20V8l8-4 8 4v12", "M8 20v-6h8v6", "M8 10h.01M12 10h.01M16 10h.01"],
    adminUsers: ["M7 18a5 5 0 0 1 10 0", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M18 8h3m-1.5-1.5v3"],
    system: ["M5 5h14v10H5V5Z", "M8 19h8M12 15v4"],
    audit: ["M6 4h12v16H6V4Z", "M9 8h6M9 12h6M9 16h3"]
  };

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      {iconPaths[icon].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
