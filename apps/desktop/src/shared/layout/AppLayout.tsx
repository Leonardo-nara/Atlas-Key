import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";
import { useDesktopUpdates } from "../../features/updates/useDesktopUpdates";
import { toMediaUrl } from "../../lib/media-url";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { StatusBadge } from "../ui/premium";

const SIDEBAR_COLLAPSED_KEY = "mototake:sidebar-collapsed";

const navigationItems = [
  { to: "/", label: "Dashboard", icon: "D", end: true },
  { to: "/setup", label: "Configuracao inicial", icon: "I" },
  { to: "/orders", label: "Pedidos", icon: "P" },
  { to: "/products", label: "Produtos", icon: "C" },
  { to: "/stock", label: "Estoque", icon: "E" },
  { to: "/pdv", label: "PDV", icon: "V" },
  { to: "/cash-registers", label: "Caixa", icon: "X" },
  { to: "/delivery-zones", label: "Taxas de entrega", icon: "T" },
  { to: "/pix-settings", label: "Pix manual", icon: "M" },
  { to: "/reports", label: "Relatorios", icon: "R" },
  { to: "/settings", label: "Configuracoes", icon: "S" },
  { to: "/couriers", label: "Motoboys", icon: "B" }
];

const adminNavigationItems = [
  { to: "/", label: "Dashboard", icon: "D", end: true },
  { to: "/admin/stores", label: "Empresas", icon: "E" },
  { to: "/admin/users", label: "Usuarios", icon: "U" },
  { to: "/admin/couriers", label: "Motoboys", icon: "B" },
  { to: "/admin/audit-logs", label: "Auditoria", icon: "A" },
  { to: "/settings", label: "Configuracoes", icon: "S" }
];

export function AppLayout() {
  const { user, store, logout, logoutAll, uploadStoreImage, removeStoreImage } =
    useAuth();
  const [storeImageError, setStoreImageError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const { isDesktop, updateState, installUpdate } = useDesktopUpdates();
  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";
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

  const shouldShowUpdateNotice =
    isDesktop && updateState.status === "downloaded" && !updateNoticeDismissed;

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
              <span>{isPlatformAdmin ? "Admin" : "Painel"}</span>
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
                  ? "Controle seguro da operacao."
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
              ? "Suporte, bloqueios e cadastros iniciais."
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
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
            <strong>{isPlatformAdmin ? "Administracao Mototake" : store?.name ?? "Mototake"}</strong>
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
          </div>
        </header>
        {shouldShowUpdateNotice ? (
          <div className="update-ready-banner">
            <div>
              <strong>Uma nova versão do Mototake está pronta.</strong>
              <span>Versão {updateState.version} baixada em segundo plano.</span>
            </div>
            <div className="row-actions">
              <button
                className="primary-button"
                onClick={() => setShowUpdateConfirm(true)}
                type="button"
              >
                Atualizar e reiniciar
              </button>
              <button
                className="ghost-button"
                onClick={() => setUpdateNoticeDismissed(true)}
                type="button"
              >
                Depois
              </button>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      {showUpdateConfirm ? (
        <ConfirmDialog
          confirmLabel="Atualizar e reiniciar"
          description="A nova versão do Mototake foi baixada e está pronta para instalação."
          onCancel={() => {
            setShowUpdateConfirm(false);
            setUpdateNoticeDismissed(true);
          }}
          onConfirm={() => void installUpdate()}
          title="Atualização pronta"
        />
      ) : null}
    </div>
  );
}
