import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/auth-context";
import { stockService } from "../features/stock/stock-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { EmptyState, MetricCard } from "../shared/ui/premium";
import type { Product, StockMovement, StockMovementType, StockSummary } from "../types/api";

const movementLabels: Record<StockMovementType, string> = {
  INITIAL: "Saldo inicial",
  PURCHASE_ENTRY: "Entrada por compra",
  MANUAL_ENTRY: "Entrada manual",
  MANUAL_EXIT: "Saida manual",
  INVENTORY_ADJUSTMENT: "Ajuste de inventario",
  PDV_SALE: "Venda no PDV",
  DELIVERY_RESERVED: "Reserva delivery",
  DELIVERY_RELEASED: "Liberacao delivery",
  RETURN: "Devolucao",
  CORRECTION: "Correcao"
};

export function StockPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState<StockMovementType>("PURCHASE_ENTRY");
  const [quantity, setQuantity] = useState(1);
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmMovement, setConfirmMovement] = useState(false);

  useEffect(() => { if (token) void load(); }, [token, status]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [productResponse, summaryResponse] = await Promise.all([
        stockService.listProducts(token, search, status),
        stockService.summary(token)
      ]);
      setProducts(productResponse.items);
      setSummary(summaryResponse);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Nao foi possivel carregar o estoque.");
    } finally {
      setLoading(false);
    }
  }

  async function selectProduct(product: Product) {
    if (!token) return;
    setSelected(product);
    const response = await stockService.movements(token, product.id);
    setMovements(response.items);
  }

  async function submitMovement() {
    if (!token || !selected) return;
    setSaving(true);
    setError(null);
    try {
      await stockService.createMovement(token, selected.id, {
        type,
        ...(type === "INVENTORY_ADJUSTMENT" ? { targetQuantity } : { quantity }),
        reason
      });
      setMessage("Movimentacao registrada com sucesso.");
      setReason("");
      await load();
      const response = await stockService.movements(token, selected.id);
      setMovements(response.items);
      const updated = (await stockService.listProducts(token, search, status)).items.find((item) => item.id === selected.id);
      if (updated) setSelected(updated);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Nao foi possivel registrar a movimentacao.");
    } finally {
      setSaving(false);
      setConfirmMovement(false);
    }
  }

  function requestMovement(event: React.FormEvent) {
    event.preventDefault();
    if (type === "MANUAL_EXIT" || type === "INVENTORY_ADJUSTMENT") {
      setConfirmMovement(true);
      return;
    }
    void submitMovement();
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Estoque"
        description="Acompanhe saldos e registre entradas ou ajustes com historico completo."
        visual="stock"
      />
      {summary ? (
        <div className="dashboard-metric-grid stock-summary-grid">
          <MetricCard icon="C" label="Controlados" value={summary.controlledProducts} />
          <MetricCard icon="D" label="Disponível" tone="success" value={summary.availableProducts} />
          <MetricCard icon="B" label="Estoque baixo" tone={summary.lowStockProducts > 0 ? "warning" : "neutral"} value={summary.lowStockProducts} />
          <MetricCard icon="S" label="Sem estoque" tone={summary.outOfStockProducts > 0 ? "danger" : "neutral"} value={summary.outOfStockProducts} />
        </div>
      ) : null}
      <div className="panel stock-filters">
        <label className="field"><span>Pesquisar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou categoria" /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos</option><option value="available">Normal</option><option value="low">Estoque baixo</option><option value="out">Sem estoque</option></select></label>
        <button className="secondary-button" onClick={() => void load()} type="button">Buscar</button>
      </div>
      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {message ? <div className="feedback feedback-success">{message}</div> : null}
      {loading ? <div className="screen-state state-loading">Carregando estoque...</div> : (
        <div className="stock-grid">
          <div className="panel stock-product-list">
            {products.length === 0 ? (
              <EmptyState icon="box" title="Nenhum produto encontrado para este filtro." />
            ) : products.map((product) => (
              <button className={`stock-product-row ${selected?.id === product.id ? "stock-product-row-active" : ""}`} key={product.id} onClick={() => void selectProduct(product)} type="button">
                <span><strong>{product.name}</strong><small>{product.stockControlEnabled ? "Controle ativo" : "Sem controle"}</small></span>
                <strong>{product.stockControlEnabled ? formatQuantity(product.stockQuantity) : "--"}</strong>
              </button>
            ))}
          </div>
          <div className="panel stock-detail">
            {!selected ? (
              <EmptyState icon="history" title="Selecione um produto para movimentar e consultar o historico." />
            ) : !selected.stockControlEnabled ? (
              <EmptyState title="Ative o controle de estoque na edicao do produto." />
            ) : (
              <>
                <div className="panel-heading"><div><span className="info-label">Saldo atual</span><h2>{selected.name}: {formatQuantity(selected.stockQuantity)}</h2></div></div>
                <form className="stock-movement-form" onSubmit={requestMovement}>
                  <label className="field"><span>Movimento</span><select value={type} onChange={(event) => setType(event.target.value as StockMovementType)}><option value="PURCHASE_ENTRY">Entrada por compra</option><option value="MANUAL_ENTRY">Entrada manual</option><option value="MANUAL_EXIT">Saida manual</option><option value="INVENTORY_ADJUSTMENT">Ajuste de inventario</option></select></label>
                  <label className="field"><span>{type === "INVENTORY_ADJUSTMENT" ? "Saldo contado" : "Quantidade"}</span><input min={type === "INVENTORY_ADJUSTMENT" ? 0 : 0.001} step="0.001" type="number" value={type === "INVENTORY_ADJUSTMENT" ? targetQuantity : quantity} onChange={(event) => type === "INVENTORY_ADJUSTMENT" ? setTargetQuantity(Number(event.target.value)) : setQuantity(Number(event.target.value))} /></label>
                  <label className="field"><span>Motivo</span><input minLength={3} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                  <button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : "Registrar movimento"}</button>
                </form>
                <div className="stock-history"><h3>Historico recente</h3>{movements.length === 0 ? <EmptyState title="Nenhuma movimentacao registrada." /> : movements.map((movement) => <article className="stock-history-row" key={movement.id}><div><strong>{movementLabels[movement.type]}</strong><p>{movement.reason || "Sem motivo informado"}</p><small>Operador: {movement.createdByUser?.name ?? "Sistema"}</small></div><div><strong>{movement.direction === "IN" ? "+" : "-"}{formatQuantity(movement.quantity)}</strong><small>{formatQuantity(movement.balanceBefore)} para {formatQuantity(movement.balanceAfter)}</small><small>{new Date(movement.createdAt).toLocaleString("pt-BR")}</small></div></article>)}</div>
              </>
            )}
          </div>
        </div>
      )}
      {confirmMovement ? (
        <ConfirmDialog
          confirmLabel="Confirmar movimentacao"
          description={`O saldo de ${selected?.name ?? "produto"} sera alterado. Motivo: ${reason}.`}
          isSubmitting={saving}
          onCancel={() => setConfirmMovement(false)}
          onConfirm={() => void submitMovement()}
          title={type === "MANUAL_EXIT" ? "Confirmar saida de estoque?" : "Confirmar ajuste de inventario?"}
          tone="danger"
        />
      ) : null}
    </section>
  );
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
}
