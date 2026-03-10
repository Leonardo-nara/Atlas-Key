import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { supabase } from "../lib/supabase";

function ProfilePage() {
  const navigate = useNavigate();

  async function handleSair() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <AppShell title="Perfil" subtitle="Conta e configurações">
      <div className="space-y-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Aqui ficarão os dados do usuário.
          </p>
        </div>

        <button
          onClick={handleSair}
          className="w-full rounded-3xl bg-red-500 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-600"
        >
          Sair da conta
        </button>
      </div>
    </AppShell>
  );
}

export default ProfilePage;
