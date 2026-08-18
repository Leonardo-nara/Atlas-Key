import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export function ContentCard({
  children,
  className = "",
  tone = "default"
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  return <section className={`content-card content-card-${tone} ${className}`}>{children}</section>;
}

export function SectionHeader({
  kicker,
  title,
  description,
  action
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {kicker ? <span className="section-kicker">{kicker}</span> : null}
        <h2>{title}</h2>
        {description ? <p className="muted-text">{description}</p> : null}
      </div>
      {action ? <div className="section-header-action">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "purple";
}) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-card" aria-label="Carregando">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "empty"
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: PremiumIconName;
}) {
  return (
    <div className="empty-state premium-empty-state">
      <span className="premium-empty-icon" aria-hidden="true">
        <PremiumIcon name={icon} />
      </span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feedback feedback-error premium-error-state">
      <span>{message}</span>
      {onRetry ? (
        <button className="ghost-button" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function PeriodFilter<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="period-filter">
      <span>Periodo</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnimatedNumber({
  value,
  format = (next) => String(Math.round(next))
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 650;
    const from = displayValueRef.current;
    const to = Number.isFinite(value) ? value : 0;
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = from + (to - from) * eased;
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(displayValue)}</>;
}

export function MetricCard({
  icon,
  label,
  value,
  numericValue,
  tone = "neutral",
  helper
}: {
  icon: string;
  label: string;
  value: string | number;
  numericValue?: number;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  helper?: string;
}) {
  const renderedValue = typeof value === "number" ? (
    <AnimatedNumber value={value} />
  ) : numericValue !== undefined ? (
    <AnimatedNumber value={numericValue} format={() => value} />
  ) : (
    value
  );

  return (
    <article className={`premium-metric-card premium-metric-card-${tone}`}>
      <div className="premium-metric-icon" aria-hidden="true">
        <PremiumIcon name={resolveIconName(icon)} />
      </div>
      <span className="info-label">{label}</span>
      <strong className="premium-metric-value">{renderedValue}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

type PremiumIconName =
  | "analytics"
  | "box"
  | "cart"
  | "cash"
  | "empty"
  | "history"
  | "package"
  | "payment"
  | "receipt"
  | "store"
  | "ticket"
  | "warning";

function resolveIconName(icon: string): PremiumIconName {
  const aliases: Record<string, PremiumIconName> = {
    "R$": "cash",
    P: "cart",
    T: "ticket",
    E: "analytics",
    "!": "warning",
    S: "box",
    C: "box",
    D: "package",
    B: "warning",
    A: "store",
    I: "store",
    O: "store",
    U: "analytics",
    M: "cart",
    "7": "analytics",
    "30": "analytics",
    analytics: "analytics",
    box: "box",
    cart: "cart",
    cash: "cash",
    empty: "empty",
    history: "history",
    package: "package",
    payment: "payment",
    receipt: "receipt",
    store: "store",
    ticket: "ticket",
    warning: "warning"
  };

  return aliases[icon] ?? "analytics";
}

function PremiumIcon({ name }: { name: PremiumIconName }) {
  const paths: Record<PremiumIconName, string[]> = {
    analytics: ["M5 19V9", "M12 19V5", "M19 19v-7", "M4 19h16"],
    box: ["M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z", "M4.5 7.2 12 11.5l7.5-4.3", "M12 11.5V21"],
    cart: ["M5 6h2l1.2 8.5h8.6L19 8H8", "M10 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z", "M17 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
    cash: ["M4 7h16v10H4V7Z", "M8 7V5h8v2", "M8 12h8", "M9 15h2"],
    empty: ["M6 9h12l-1 10H7L6 9Z", "M9 9V6h6v3", "M10 13h4"],
    history: ["M4 12a8 8 0 1 0 2.4-5.7", "M4 5v5h5", "M12 8v5l3 2"],
    package: ["M5 8h14v11H5V8Z", "M8 8V5h8v3", "M9 13h6"],
    payment: ["M4 7h16v10H4V7Z", "M4 11h16", "M8 15h4"],
    receipt: ["M7 4h10v16l-2-1-2 1-2-1-2 1-2-1V4Z", "M9 8h6", "M9 12h6", "M9 16h3"],
    store: ["M4 10h16l-1.2-5H5.2L4 10Z", "M6 10v10h12V10", "M9 20v-6h6v6"],
    ticket: ["M5 7h14v4a2 2 0 0 0 0 4v4H5v-4a2 2 0 0 0 0-4V7Z", "M12 8v10"],
    warning: ["M12 4 3.5 19h17L12 4Z", "M12 9v4", "M12 16h.01"]
  };

  return (
    <svg className="premium-line-icon" viewBox="0 0 24 24" focusable="false">
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}

export function AreaChart({
  data,
  formatValue
}: {
  data: Array<{ label: string; value: number }>;
  formatValue: (value: number) => string;
}) {
  const chart = useMemo(() => {
    const width = 640;
    const height = 260;
    const padding = 28;
    const values = data.map((item) => item.value);
    const max = Math.max(1, ...values);
    const min = Math.min(0, ...values);
    const range = Math.max(1, max - min);
    const step = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    const points = data.map((item, index) => {
      const x = padding + step * index;
      const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
      return { ...item, x, y };
    });
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const area = `${line} L ${points.at(-1)?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`;

    return { width, height, points, line, area, max };
  }, [data]);

  if (data.length === 0) {
    return <EmptyState title="Sem faturamento no periodo" description="Os dados aparecem aqui quando houver vendas ou pedidos realizados." />;
  }

  return (
    <div className="chart-shell">
      <svg className="area-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Faturamento no periodo">
        <defs>
          <linearGradient id="mototake-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.42)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.02)" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <line
            className="chart-grid-line"
            key={ratio}
            x1="28"
            x2={chart.width - 28}
            y1={28 + ratio * (chart.height - 56)}
            y2={28 + ratio * (chart.height - 56)}
          />
        ))}
        <path className="area-chart-fill" d={chart.area} />
        <path className="area-chart-line" d={chart.line} />
        {chart.points.map((point) => (
          <g className="area-chart-point" key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{`${point.label}: ${formatValue(point.value)}`}</title>
          </g>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{data[0]?.label}</span>
        <strong>{formatValue(chart.max)}</strong>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  );
}

export function DonutChart({
  items,
  totalLabel,
  formatValue
}: {
  items: Array<{ label: string; value: number; color: string }>;
  totalLabel: string;
  formatValue: (value: number) => string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total <= 0) {
    return <EmptyState title="Sem pagamentos no periodo" description="As formas de pagamento aparecem quando houver vendas." />;
  }

  return (
    <div className="donut-layout">
      <svg className="donut-chart" viewBox="0 0 120 120" role="img" aria-label="Composicao de pagamentos">
        <circle className="donut-track" cx="60" cy="60" r={radius} />
        {items.map((item) => {
          const dash = (item.value / total) * circumference;
          const currentOffset = offset;
          offset += dash;
          return (
            <circle
              className="donut-segment"
              cx="60"
              cy="60"
              key={item.label}
              r={radius}
              stroke={item.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
            />
          );
        })}
        <text className="donut-total" x="60" y="56">
          {Math.round(total)}
        </text>
        <text className="donut-caption" x="60" y="72">
          {totalLabel}
        </text>
      </svg>
      <div className="donut-legend">
        {items.map((item) => (
          <div className="donut-legend-item" key={item.label}>
            <span style={{ background: item.color }} />
            <div>
              <strong>{item.label}</strong>
              <small>{formatValue(item.value)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
