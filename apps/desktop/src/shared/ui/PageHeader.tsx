import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="section-kicker">Operação</p>
        <h2>{title}</h2>
        <p className="muted-text">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}
