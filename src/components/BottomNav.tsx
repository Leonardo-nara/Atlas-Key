import { NavLink } from "react-router-dom";

function linkClass(isActive: boolean) {
  return `flex flex-1 flex-col items-center justify-center rounded-2xl px-3 py-2 text-xs font-medium transition ${
    isActive ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md gap-2">
        <NavLink to="/home" className={({ isActive }) => linkClass(isActive)}>
          <span>Início</span>
        </NavLink>

        <NavLink
          to="/catalogo"
          className={({ isActive }) => linkClass(isActive)}
        >
          <span>Catálogo</span>
        </NavLink>

        <NavLink
          to="/cadastrar-chave"
          className={({ isActive }) => linkClass(isActive)}
        >
          <span>Cadastrar</span>
        </NavLink>

        <NavLink
          to="/historico"
          className={({ isActive }) => linkClass(isActive)}
        >
          <span>Histórico</span>
        </NavLink>

        <NavLink to="/perfil" className={({ isActive }) => linkClass(isActive)}>
          <span>Perfil</span>
        </NavLink>
      </div>
    </nav>
  );
}

export default BottomNav;
