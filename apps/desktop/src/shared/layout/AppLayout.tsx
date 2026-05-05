import type { ChangeEvent } from "react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";
import { toMediaUrl } from "../../lib/media-url";

const navigationItems = [
  { to: "/", label: "Visao geral", end: true },
  { to: "/products", label: "Produtos" },
  { to: "/orders", label: "Pedidos" },
  { to: "/couriers", label: "Motoboys" },
  { to: "/delivery-zones", label: "Taxas por bairro" },
  { to: "/pix-settings", label: "Pix manual" }
];

const adminNavigationItems = [
  { to: "/", label: "Visao geral", end: true },
  { to: "/admin/stores", label: "Empresas" },
  { to: "/admin/users", label: "Usuarios" },
  { to: "/admin/couriers", label: "Motoboys" }
];

export function AppLayout() {
  const { user, store, logout, logoutAll, uploadStoreImage, removeStoreImage } =
    useAuth();
  const [storeImageError, setStoreImageError] = useState<string | null>(null);
  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";
  const isStoreAdmin = user?.role === "STORE_ADMIN";
  const activeNavigationItems = isPlatformAdmin
    ? adminNavigationItems
    : isStoreAdmin
      ? navigationItems
      : [];

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
    <div className="desktop-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="store-avatar">
            {isPlatformAdmin ? (
              <span>A</span>
            ) : store?.imageUrl ? (
              <img
                alt={`Imagem de ${store.name}`}
                src={toMediaUrl(store.imageUrl) ?? undefined}
              />
            ) : (
              <span>{store?.name?.slice(0, 1).toUpperCase() ?? "L"}</span>
            )}
          </div>
          <p className="section-kicker">
            {isPlatformAdmin ? "Administracao interna" : "Painel empresarial"}
          </p>
          <h1>{isPlatformAdmin ? "Plataforma" : store?.name ?? "Loja"}</h1>
          <p>
            {isPlatformAdmin
              ? "Gerencie empresas, usuarios e motoboys com acesso restrito."
              : store?.address || "Complete o endereco da loja quando quiser."}
          </p>
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
              ? "Acesso administrativo para suporte, bloqueios e cadastro inicial."
              : "Acompanhe pedidos, catalogo e vinculos com um painel mais claro para a rotina da empresa."}
          </p>
        </div>

        <nav className="sidebar-nav">
          {activeNavigationItems.length > 0 ? activeNavigationItems.map((item) => (
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
          )) : (
            <span className="nav-item">Acesso indisponivel</span>
          )}
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
