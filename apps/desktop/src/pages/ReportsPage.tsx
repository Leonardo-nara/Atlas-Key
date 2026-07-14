import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import { reportsService } from "../features/reports/reports-service";
import { ApiError } from "../lib/http";
import { useAuth } from "../features/auth/auth-context";
import { PageHeader } from "../shared/ui/PageHeader";
import type {
  ReportCashResponse,
  ReportListFilters,
  ReportOverview,
  ReportPeriod,
  ReportProductsResponse,
  ReportSalesResponse,
  ReportStockResponse
} from "../types/api";

type ReportsState =
  | { status: "idle" | "loading"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

const periodOptions: Array<{ value: ReportPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "current_month", label: "Mês atual" },
  { value: "custom", label: "Período personalizado" }
];

export function ReportsPage() {
  const { token } = useAuth();
  const [filters, setFilters] = useState<ReportListFilters>({
    period: "today",
    page: 1,
    limit: 20
  });
  const [draftFilters, setDraftFilters] = useState<ReportListFilters>(filters);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [sales, setSales] = useState<ReportSalesResponse | null>(null);
  const [products, setProducts] = useState<ReportProductsResponse | null>(null);
  const [cash, setCash] = useState<ReportCashResponse | null>(null);
  const [stock, setStock] = useState<ReportStockResponse | null>(null);
  const [state, setState] = useState<ReportsState>({ status: "idle", error: null });
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const closedCashSession = cash?.items.find((session) => session.status === "CLOSED");

  useEffect(() => {
    if (!token) return;
    const currentToken = token;
    let active = true;
    setState({ status: "loading", error: null });

    async function loadReports() {
      try {
        const [overviewResponse, salesResponse, productsResponse, cashResponse, stockResponse] =
          await Promise.all([
            reportsService.overview(currentToken, filters),
            reportsService.sales(currentToken, filters),
            reportsService.products(currentToken, filters),
            reportsService.cash(currentToken, filters),
            reportsService.stock(currentToken, filters)
          ]);

        if (!active) return;
        setOverview(overviewResponse);
        setSales(salesResponse);
        setProducts(productsResponse);
        setCash(cashResponse);
        setStock(stockResponse);
        setState({ status: "success", error: null });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          error: error instanceof ApiError ? error.message : "Não foi possível carregar os relatórios."
        });
      }
    }

    void loadReports();

    return () => {
      active = false;
    };
  }, [filters, token]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (draftFilters.period === "custom" && (!draftFilters.dateFrom || !draftFilters.dateTo)) {
      setState({ status: "error", error: "Informe data inicial e final para período personalizado." });
      return;
    }

    if (
      draftFilters.period === "custom" &&
      draftFilters.dateFrom &&
      draftFilters.dateTo &&
      draftFilters.dateFrom > draftFilters.dateTo
    ) {
      setState({ status: "error", error: "A data inicial não pode ser posterior à data final." });
      return;
    }

    setFilters({ ...draftFilters, page: 1, limit: draftFilters.limit ?? 20 });
  }

  async function handleDownload(type: "sales" | "products" | "cash" | "stock") {
    if (!token) return;

    try {
      setDownloadState(type);
      const file = await reportsService.downloadCsv(token, type, filters);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setState({ status: "error", error: "Não foi possível exportar o CSV." });
    } finally {
      setDownloadState(null);
    }
  }

  return (
    <section className="page-section reports-page">
      <PageHeader
        title="Relatórios"
        description="Acompanhe vendas, recebimentos, caixa e estoque com visão gerencial sem valor fiscal."
      />

      <form className="panel report-filter-panel" onSubmit={handleSubmit}>
        <label>
          Período
          <select
            className="filter-select"
            value={draftFilters.period}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                period: event.target.value as ReportPeriod
              }))
            }
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {draftFilters.period === "custom" ? (
          <>
            <label>
              Data inicial
              <input
                type="date"
                value={draftFilters.dateFrom ?? ""}
                onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </label>
            <label>
              Data final
              <input
                type="date"
                value={draftFilters.dateTo ?? ""}
                onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </label>
          </>
        ) : null}

        <label>
          Busca
          <input
            placeholder="Cliente, número ou identificador"
            value={draftFilters.search ?? ""}
            onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </label>

        <button className="primary-button" type="submit">
          Atualizar relatórios
        </button>
      </form>

      {state.status === "loading" ? (
        <div className="screen-state state-loading">Carregando relatórios...</div>
      ) : null}

      {state.status === "error" ? <div className="feedback feedback-error">{state.error}</div> : null}

      {overview ? (
        <>
          <div className="info-grid">
            <MetricCard label="Total vendido" value={formatCurrency(overview.sales.soldAmount)} />
            <MetricCard label="Total recebido" value={formatCurrency(overview.sales.paidAmount)} />
            <MetricCard label="Quantidade realizada" value={overview.sales.realizedCount} />
            <MetricCard label="Delivery" value={formatCurrency(overview.sales.deliverySoldAmount)} />
            <MetricCard label="PDV" value={formatCurrency(overview.sales.pdvSoldAmount)} />
            <MetricCard label="Ticket médio" value={formatCurrency(overview.sales.averageTicket)} />
            <MetricCard label="Pagamentos pendentes" value={formatCurrency(overview.sales.pendingAmount)} />
            <MetricCard label="Caixa esperado" value={formatCurrency(closedCashSession?.expectedCashAmount ?? 0)} />
            <MetricCard
              label="Saldo contado"
              value={closedCashSession?.countedCashAmount != null ? formatCurrency(closedCashSession.countedCashAmount) : "Não informado"}
            />
            <MetricCard label="Diferenças de caixa" value={formatCurrency(overview.operation.closedCashDifferenceAmount)} />
            <MetricCard label="Estoque baixo" value={overview.stock.lowStockProducts} />
            <MetricCard label="Sem estoque" value={overview.stock.outOfStockProducts} />
          </div>

          <div className="report-actions">
            <ExportButton label="Exportar vendas CSV" loading={downloadState === "sales"} onClick={() => void handleDownload("sales")} />
            <ExportButton label="Exportar produtos CSV" loading={downloadState === "products"} onClick={() => void handleDownload("products")} />
            <ExportButton label="Exportar caixa CSV" loading={downloadState === "cash"} onClick={() => void handleDownload("cash")} />
            <ExportButton label="Exportar estoque CSV" loading={downloadState === "stock"} onClick={() => void handleDownload("stock")} />
          </div>

          <div className="report-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="info-label">Pagamentos</span>
                  <h2>Vendas por forma de pagamento</h2>
                </div>
              </div>
              {overview.sales.byPaymentMethod.length === 0 ? (
                <div className="empty-state">Nenhuma venda realizada no período.</div>
              ) : (
                overview.sales.byPaymentMethod.map((item) => (
                  <ReportBar key={item.method} label={paymentMethodLabel(item.method)} value={item.amount} max={overview.sales.soldAmount} />
                ))
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="info-label">Produtos</span>
                  <h2>Mais vendidos</h2>
                </div>
              </div>
              {overview.stock.topSellingProducts.length === 0 ? (
                <div className="empty-state">Nenhum produto vendido no período.</div>
              ) : (
                overview.stock.topSellingProducts.map((item) => (
                  <div className="report-line" key={item.productId ?? item.name}>
                    <span>{item.name}</span>
                    <strong>{item.quantitySold} un. · {formatCurrency(item.soldAmount)}</strong>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      ) : null}

      <section className="panel data-table report-table">
        <div className="panel-heading">
          <div>
            <span className="info-label">Vendas</span>
            <h2>Lista unificada</h2>
          </div>
        </div>
        {!sales || sales.items.length === 0 ? (
          <div className="empty-state">Nenhuma venda ou pedido encontrado no período.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Recebido</th>
              </tr>
            </thead>
            <tbody>
              {sales.items.map((item) => (
                <tr key={`${item.origin}-${item.id}`}>
                  <td>{formatDate(item.occurredAt)}</td>
                  <td>{item.origin}</td>
                  <td>{item.customerName ?? "Sem cliente"}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td>{paymentMethodLabel(item.paymentMethod ?? "")} · {paymentStatusLabel(item.paymentStatus)}</td>
                  <td>{formatCurrency(item.soldAmount)}</td>
                  <td>{formatCurrency(item.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="report-grid">
        <SimplePanel title="Sessões de caixa" empty={!cash || cash.items.length === 0}>
          {cash?.items.slice(0, 6).map((session) => (
            <div className="report-line" key={session.id}>
              <span>
                {session.cashRegister.name} · {session.status === "OPEN" ? "Aberto" : "Fechado"}
                {session.countedCashAmount != null ? ` · contado ${formatCurrency(session.countedCashAmount)}` : ""}
              </span>
              <strong>
                esperado {formatCurrency(session.expectedCashAmount)}
                {session.differenceAmount != null ? ` · diferença ${formatCurrency(session.differenceAmount)}` : ""}
              </strong>
            </div>
          ))}
        </SimplePanel>

        <SimplePanel title="Estoque crítico" empty={!stock || stock.items.filter((item) => item.stockStatus === "LOW_STOCK" || item.stockStatus === "OUT_OF_STOCK").length === 0}>
          {stock?.items
            .filter((item) => item.stockStatus === "LOW_STOCK" || item.stockStatus === "OUT_OF_STOCK")
            .slice(0, 8)
            .map((item) => (
              <div className="report-line" key={item.product.id}>
                <span>{item.product.name}</span>
                <strong>{stockStatusLabel(item.stockStatus)} · {formatQuantity(item.currentStock)}</strong>
              </div>
            ))}
        </SimplePanel>

        <SimplePanel title="Produtos no período" empty={!products || products.items.length === 0}>
          {products?.items.slice(0, 8).map((item) => (
            <div className="report-line" key={item.product.id}>
              <span>{item.product.name}</span>
              <strong>{item.totalQuantitySold} un. · {formatCurrency(item.soldAmount)}</strong>
            </div>
          ))}
        </SimplePanel>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="info-card metric-card metric-card-primary">
      <span className="info-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}

function ExportButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button className="secondary-button" disabled={loading} onClick={onClick} type="button">
      {loading ? "Exportando..." : label}
    </button>
  );
}

function ReportBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));

  return (
    <div className="report-bar">
      <div className="report-line">
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
      </div>
      <div className="report-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SimplePanel({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="info-label">Resumo</span>
          <h2>{title}</h2>
        </div>
      </div>
      {empty ? <div className="empty-state">Nenhum registro encontrado.</div> : children}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
}

function paymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    CASH: "Dinheiro",
    CARD: "Cartão",
    CARD_ON_DELIVERY: "Cartão na entrega",
    PIX_MANUAL: "Pix manual",
    ONLINE: "Pix automático",
    PIX_AUTOMATIC: "Pix automático"
  };

  return labels[value] ?? value;
}

function paymentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    PAID: "Pago",
    FAILED: "Falhou",
    CANCELLED: "Cancelado",
    REFUNDED: "Estornado"
  };

  return labels[value] ?? value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
    PENDING: "Pendente",
    ACCEPTED: "Confirmado",
    ASSIGNED: "Com motoboy",
    OUT_FOR_DELIVERY: "Saiu para entrega",
    DELIVERED: "Entregue"
  };

  return labels[value] ?? value;
}

function stockStatusLabel(value: string) {
  const labels: Record<string, string> = {
    NO_CONTROL: "Sem controle",
    IN_STOCK: "Normal",
    LOW_STOCK: "Estoque baixo",
    OUT_OF_STOCK: "Sem estoque"
  };

  return labels[value] ?? value;
}
