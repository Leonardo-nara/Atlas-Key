import type { ReactNode } from "react";
import BottomNav from "./BottomNav";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto w-full max-w-md px-4 py-5">
        <header className="mb-5 rounded-3xl bg-gradient-to-br from-teal-700 to-teal-500 p-5 text-white shadow-xl">
          <p className="text-sm font-medium text-teal-100">Atlas</p>
          <h1 className="mt-1 text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-teal-50">{subtitle}</p>}
        </header>

        {children}
      </div>

      <BottomNav />
    </main>
  );
}

export default AppShell;
