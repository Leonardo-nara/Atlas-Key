import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  kicker = "Operacao",
  notice,
  visual = "default"
}: {
  title: string;
  description: string;
  action?: ReactNode;
  kicker?: string;
  notice?: ReactNode;
  visual?: "default" | "dashboard" | "stock" | "products" | "orders" | "pdv" | "setup";
}) {
  return (
    <header className={`page-header page-header-${visual}`}>
      <div className="page-header-copy">
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="muted-text">{description}</p>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
      {notice ? <div className="page-header-notice">{notice}</div> : null}
    </header>
  );
}
