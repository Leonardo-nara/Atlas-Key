import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import { productsService } from "../features/products/products-service";
import {
  salesService,
  type CompleteSalePaymentInput
} from "../features/sales/sales-service";
import { ApiError } from "../lib/http";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { PageHeader } from "../shared/ui/PageHeader";
import type { Product, Sale, SalePaymentMethod, SaleReceipt } from "../types/api";

const paymentOptions: Array<{ method: SalePaymentMethod; label: string }> = [
  { method: "CASH", label: "Dinheiro" },
  { method: "CARD", label: "Cartao" },
  { method: "PIX_MANUAL", label: "Pix manual" }
];

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseMoneyDraft(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function paymentMethodLabel(method: SalePaymentMethod) {
  return paymentOptions.find((option) => option.method === method)?.label ?? method;
}

export function PdvPage() {
  const { token, store, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [discountDraft, setDiscountDraft] = useState("0");
  const [surchargeDraft, setSurchargeDraft] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("CASH");
  const [paymentAmountDraft, setPaymentAmountDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadInitialData();
  }, [token]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        openPaymentModal();
      }

      if (event.key === "Escape") {
        setPaymentModalOpen(false);
        setConfirmCancelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sale, discountDraft, surchargeDraft]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [successMessage]);

  const filteredProducts = useMemo(() => {
    const normalized = normalizeSearch(search);
    const availableProducts = products.filter((product) => product.available);

    if (!normalized) {
      return availableProducts.slice(0, 8);
    }

    return availableProducts
      .filter((product) =>
        normalizeSearch(`${product.name} ${product.category}`).includes(normalized)
      )
      .slice(0, 12);
  }, [products, search]);

  const projectedTotals = useMemo(() => {
    const discount = parseMoneyDraft(discountDraft);
    const surcharge = parseMoneyDraft(surchargeDraft);
    const safeDiscount = Number.isFinite(discount) ? discount : 0;
    const safeSurcharge = Number.isFinite(surcharge) ? surcharge : 0;
    const subtotal = sale?.subtotal ?? 0;

    return {
      subtotal,
      discount: safeDiscount,
      surcharge: safeSurcharge,
      total: Math.max(0, subtotal - safeDiscount + safeSurcharge)
    };
  }, [discountDraft, sale?.subtotal, surchargeDraft]);

  async function loadInitialData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loadedProducts, loadedSales] = await Promise.all([
        productsService.list(token),
        salesService.list(token, { page: 1 })
      ]);
      setProducts(loadedProducts);
      setRecentSales(loadedSales.items);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar o PDV."
      );
    } finally {
      setLoading(false);
    }
  }

  async function ensureDraftSale() {
    if (!token) {
      throw new Error("Sessao indisponivel.");
    }

    if (sale?.status === "DRAFT") {
      return sale;
    }

    const createdSale = await salesService.create(token, {
      customerName: customerName.trim() || undefined,
      customerDocument: customerDocument.trim() || undefined,
      notes: notes.trim() || undefined
    });
    setSale(createdSale);
    return createdSale;
  }

  async function handleAddProduct(product: Product) {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const draftSale = await ensureDraftSale();
      const updatedSale = await salesService.addItem(token, draftSale.id, {
        productId: product.id,
        quantity: 1
      });
      setSale(updatedSale);
      setSearch("");
    } catch (addError) {
      setError(
        addError instanceof ApiError
          ? addError.message
          : "Nao foi possivel adicionar o produto."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeQuantity(itemId: string, quantity: number) {
    if (!token || !sale || quantity < 1) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedSale = await salesService.updateItem(token, sale.id, itemId, {
        quantity
      });
      setSale(updatedSale);
    } catch (updateError) {
      setError(
        updateError instanceof ApiError
          ? updateError.message
          : "Nao foi possivel alterar a quantidade."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!token || !sale) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedSale = await salesService.removeItem(token, sale.id, itemId);
      setSale(updatedSale);
    } catch (removeError) {
      setError(
        removeError instanceof ApiError
          ? removeError.message
          : "Nao foi possivel remover o item."
      );
    } finally {
      setSaving(false);
    }
  }

  function openPaymentModal() {
    if (!sale || sale.items.length === 0) {
      setError("Adicione pelo menos um produto antes de finalizar a venda.");
      return;
    }

    setPaymentAmountDraft(projectedTotals.total.toFixed(2));
    setPaymentModalOpen(true);
  }

  async function handleCompleteSale() {
    if (!token || !sale) {
      return;
    }

    const discountAmount = parseMoneyDraft(discountDraft);
    const surchargeAmount = parseMoneyDraft(surchargeDraft);
    const paymentAmount = parseMoneyDraft(paymentAmountDraft);

    if (![discountAmount, surchargeAmount, paymentAmount].every(Number.isFinite)) {
      setError("Informe valores monetarios validos.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedSale = await salesService.update(token, sale.id, {
        customerName: customerName.trim() || undefined,
        customerDocument: customerDocument.trim() || undefined,
        notes: notes.trim() || undefined,
        discountAmount,
        surchargeAmount
      });
      const payments: CompleteSalePaymentInput[] = [
        {
          method: paymentMethod,
          amount: paymentAmount
        }
      ];
      const completedSale = await salesService.complete(token, updatedSale.id, payments);
      const saleReceipt = await salesService.receipt(token, completedSale.id);

      setSale(completedSale);
      setReceipt(saleReceipt);
      setPaymentModalOpen(false);
      setSuccessMessage("Venda finalizada com sucesso.");
      await loadInitialData();
    } catch (completeError) {
      setError(
        completeError instanceof ApiError
          ? completeError.message
          : "Nao foi possivel finalizar a venda."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSale() {
    if (!token || !sale) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const cancelledSale = await salesService.cancel(
        token,
        sale.id,
        "Venda cancelada no PDV"
      );
      setSale(cancelledSale);
      resetDraft();
      setSuccessMessage("Venda cancelada.");
      await loadInitialData();
    } catch (cancelError) {
      setError(
        cancelError instanceof ApiError
          ? cancelError.message
          : "Nao foi possivel cancelar a venda."
      );
    } finally {
      setSaving(false);
      setConfirmCancelOpen(false);
    }
  }

  function resetDraft() {
    setSale(null);
    setCustomerName("");
    setCustomerDocument("");
    setNotes("");
    setDiscountDraft("0");
    setSurchargeDraft("0");
    setPaymentMethod("CASH");
    setPaymentAmountDraft("");
  }

  return (
    <section className="page-section">
      <PageHeader
        title="PDV"
        description="Venda presencial de balcão com recibo interno sem valor fiscal."
        action={
          <div className="page-header-action">
            <button
              className="secondary-button"
              disabled={!sale || saving}
              onClick={() => setConfirmCancelOpen(true)}
              type="button"
            >
              Cancelar venda
            </button>
            <button className="primary-button" onClick={openPaymentModal} type="button">
              Finalizar venda F2
            </button>
          </div>
        }
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="screen-state state-loading">Carregando PDV...</div>
      ) : (
        <div className="pdv-grid">
          <div className="panel form-grid">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Produtos</p>
                <h3>Adicionar ao carrinho</h3>
              </div>
            </div>

            <label className="field">
              <span>Buscar produto</span>
              <input
                autoFocus
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite o nome ou categoria do produto"
                value={search}
              />
            </label>

            <div className="pdv-product-list">
              {filteredProducts.length === 0 ? (
                <div className="empty-state">
                  Nenhum produto disponivel encontrado para a busca.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    className="pdv-product-card"
                    disabled={saving}
                    key={product.id}
                    onClick={() => void handleAddProduct(product)}
                    type="button"
                  >
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.category}</small>
                    </span>
                    <strong>{formatMoney(product.price)}</strong>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel form-grid">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Venda atual</p>
                <h3>{sale ? `Venda ${sale.id.slice(-6).toUpperCase()}` : "Nova venda"}</h3>
              </div>
              <span className="pill">DOCUMENTO SEM VALOR FISCAL</span>
            </div>

            <div className="form-columns">
              <label className="field">
                <span>Cliente opcional</span>
                <input
                  maxLength={160}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nome do cliente"
                  value={customerName}
                />
              </label>
              <label className="field">
                <span>Documento opcional</span>
                <input
                  maxLength={40}
                  onChange={(event) => setCustomerDocument(event.target.value)}
                  placeholder="CPF/CNPJ se informado"
                  value={customerDocument}
                />
              </label>
            </div>

            <div className="pdv-cart">
              {sale?.items.length ? (
                sale.items.map((item) => (
                  <div className="pdv-cart-row" key={item.id}>
                    <div>
                      <strong>{item.productNameSnapshot}</strong>
                      <p>{formatMoney(item.unitPrice)} un.</p>
                    </div>
                    <label className="field field-small">
                      <span>Qtd.</span>
                      <input
                        min={1}
                        onChange={(event) =>
                          void handleChangeQuantity(item.id, Number(event.target.value))
                        }
                        type="number"
                        value={item.quantity}
                      />
                    </label>
                    <strong>{formatMoney(item.total)}</strong>
                    <button
                      className="danger-button"
                      disabled={saving}
                      onClick={() => void handleRemoveItem(item.id)}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  O carrinho ainda está vazio. Busque um produto e adicione à venda.
                </div>
              )}
            </div>

            <div className="form-columns">
              <label className="field">
                <span>Desconto</span>
                <input
                  min="0"
                  onChange={(event) => setDiscountDraft(event.target.value)}
                  step="0.01"
                  type="number"
                  value={discountDraft}
                />
              </label>
              <label className="field">
                <span>Acréscimo</span>
                <input
                  min="0"
                  onChange={(event) => setSurchargeDraft(event.target.value)}
                  step="0.01"
                  type="number"
                  value={surchargeDraft}
                />
              </label>
            </div>

            <label className="field">
              <span>Observação</span>
              <textarea
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
                rows={3}
                value={notes}
              />
            </label>

            <div className="order-summary">
              <div>
                Subtotal
                <strong>{formatMoney(projectedTotals.subtotal)}</strong>
              </div>
              <div>
                Ajustes
                <strong>
                  -{formatMoney(projectedTotals.discount)} / +
                  {formatMoney(projectedTotals.surcharge)}
                </strong>
              </div>
              <div>
                Total
                <strong>{formatMoney(projectedTotals.total)}</strong>
              </div>
            </div>
          </div>

          <div className="panel form-grid pdv-history-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Histórico rápido</p>
                <h3>Últimas vendas</h3>
              </div>
            </div>

            {recentSales.length === 0 ? (
              <div className="empty-state">Nenhuma venda registrada ainda.</div>
            ) : (
              <div className="stack-list">
                {recentSales.slice(0, 6).map((recentSale) => (
                  <div className="inline-card pdv-history-card" key={recentSale.id}>
                    <div>
                      <strong>{recentSale.id.slice(-8).toUpperCase()}</strong>
                      <p>
                        {recentSale.customerName ?? "Cliente não informado"} ·{" "}
                        {new Date(recentSale.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <span>{recentSale.status === "COMPLETED" ? "Finalizada" : recentSale.status}</span>
                    <strong>{formatMoney(recentSale.total)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {paymentModalOpen ? (
        <div className="modal-backdrop" onClick={() => setPaymentModalOpen(false)} role="presentation">
          <div
            aria-labelledby="complete-sale-title"
            aria-modal="true"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Pagamento</p>
                <h3 id="complete-sale-title">Finalizar venda</h3>
              </div>
              <button className="ghost-button" onClick={() => setPaymentModalOpen(false)} type="button">
                Fechar
              </button>
            </div>

            <div className="order-summary">
              <div>
                Loja
                <strong>{store?.name ?? "Loja"}</strong>
              </div>
              <div>
                Operador
                <strong>{user?.name ?? "Operador"}</strong>
              </div>
              <div>
                Total
                <strong>{formatMoney(projectedTotals.total)}</strong>
              </div>
            </div>

            <label className="field">
              <span>Forma de pagamento</span>
              <select
                onChange={(event) => setPaymentMethod(event.target.value as SalePaymentMethod)}
                value={paymentMethod}
              >
                {paymentOptions.map((option) => (
                  <option key={option.method} value={option.method}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {paymentMethod === "PIX_MANUAL" ? (
              <div className="feedback feedback-info">
                Pix manual no PDV registra somente a forma de pagamento. Não há QR Code automático
                nesta fase.
              </div>
            ) : null}

            <label className="field">
              <span>Valor recebido</span>
              <input
                min="0.01"
                onChange={(event) => setPaymentAmountDraft(event.target.value)}
                step="0.01"
                type="number"
                value={paymentAmountDraft}
              />
            </label>

            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={saving}
                onClick={() => setPaymentModalOpen(false)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => void handleCompleteSale()}
                type="button"
              >
                {saving ? "Finalizando..." : "Confirmar venda"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="modal-backdrop" onClick={() => setReceipt(null)} role="presentation">
          <div
            aria-labelledby="sale-receipt-title"
            aria-modal="true"
            className="modal-card receipt-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Recibo interno</p>
                <h3 id="sale-receipt-title">Venda finalizada</h3>
              </div>
              <button
                className="ghost-button"
                onClick={() => {
                  setReceipt(null);
                  resetDraft();
                }}
                type="button"
              >
                Nova venda
              </button>
            </div>

            <div className="receipt-paper">
              <strong className="receipt-notice">{receipt.notice}</strong>
              <h3>{receipt.sale.store?.name ?? store?.name ?? "Loja"}</h3>
              <p>{receipt.sale.store?.address ?? store?.address}</p>
              <p>Venda: {receipt.sale.id}</p>
              <p>Data: {new Date(receipt.sale.completedAt ?? receipt.generatedAt).toLocaleString("pt-BR")}</p>
              <p>Operador: {receipt.sale.operator?.name ?? user?.name}</p>
              {receipt.sale.customerName ? <p>Cliente: {receipt.sale.customerName}</p> : null}

              <ul className="order-items">
                {receipt.sale.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.quantity}x {item.productNameSnapshot}
                    </span>
                    <strong>{formatMoney(item.total)}</strong>
                  </li>
                ))}
              </ul>

              <div className="order-totals">
                <span>Subtotal</span>
                <strong>{formatMoney(receipt.sale.subtotal)}</strong>
              </div>
              <div className="order-totals">
                <span>Desconto</span>
                <strong>{formatMoney(receipt.sale.discountAmount)}</strong>
              </div>
              <div className="order-totals">
                <span>Acréscimo</span>
                <strong>{formatMoney(receipt.sale.surchargeAmount)}</strong>
              </div>
              <div className="order-totals">
                <span>Total</span>
                <strong>{formatMoney(receipt.sale.total)}</strong>
              </div>
              <p>
                Pagamento:{" "}
                {receipt.sale.payments
                  .map((payment) => paymentMethodLabel(payment.method))
                  .join(", ")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCancelOpen ? (
        <ConfirmDialog
          confirmLabel="Cancelar venda"
          description="A venda em rascunho será cancelada e registrada na auditoria do PDV."
          isSubmitting={saving}
          onCancel={() => setConfirmCancelOpen(false)}
          onConfirm={() => void handleCancelSale()}
          title="Cancelar venda atual?"
          tone="danger"
        />
      ) : null}
    </section>
  );
}
