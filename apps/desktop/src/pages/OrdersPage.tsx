import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import { OrderForm } from "../features/orders/OrderForm";
import {
  ordersService,
  type CreateOrderInput
} from "../features/orders/orders-service";
import { productsService } from "../features/products/products-service";
import { useRealtime } from "../features/realtime/realtime-context";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { Order, OrderAuditEvent, Product } from "../types/api";

function formatOrderStatus(status: Order["status"], statusLabel?: string) {
  const normalizedStatus = statusLabel ?? status.toLowerCase();

  if (normalizedStatus === "pending") {
    return "Aguardando confirmação";
  }

  if (normalizedStatus === "awaiting_store_confirmation") {
    return "Aguardando confirmação";
  }

  if (normalizedStatus === "confirmed") {
    return "Confirmado pela loja";
  }

  if (normalizedStatus === "accepted") {
    return "Motoboy aceitou";
  }

  if (normalizedStatus === "picked_up") {
    return "Saiu para entrega";
  }

  if (normalizedStatus === "delivered") {
    return "Entregue";
  }

  return "Cancelado";
}

function formatAuditType(type: OrderAuditEvent["type"]) {
  if (type === "created") {
    return "Pedido criado";
  }

  if (type === "accepted") {
    return "Pedido aceito";
  }

  if (type === "picked_up") {
    return "Pedido coletado";
  }

  if (type === "delivered") {
    return "Pedido entregue";
  }

  if (type === "payment_paid") {
    return "Pagamento marcado como pago";
  }

  return "Pedido cancelado";
}

function formatActorRole(role?: OrderAuditEvent["actorRole"]) {
  if (role === "STORE_ADMIN") {
    return "Administrador da loja";
  }

  if (role === "COURIER") {
    return "Motoboy";
  }

  if (role === "CLIENT") {
    return "Cliente";
  }

  return "Sistema";
}

function formatFulfillmentType(order: Order) {
  return order.fulfillmentType === "PICKUP" ? "Retirada na loja" : "Entrega";
}

function formatPaymentMethod(method?: Order["paymentMethod"]) {
  if (method === "CARD_ON_DELIVERY") {
    return "Cartão na entrega";
  }

  if (method === "PIX_MANUAL") {
    return "Pix manual";
  }

  if (method === "ONLINE") {
    return "Online (futuro)";
  }

  return "Dinheiro na entrega";
}

function formatPaymentStatus(status?: Order["paymentStatus"]) {
  if (status === "PAID") {
    return "Pago";
  }

  if (status === "FAILED") {
    return "Falhou";
  }

  if (status === "CANCELLED") {
    return "Cancelado";
  }

  if (status === "REFUNDED") {
    return "Reembolsado";
  }

  return "Aguardando pagamento";
}

function canMarkPaymentPaid(order: Order) {
  return Boolean(
    order.paymentStatus !== "PAID" &&
      order.paymentMethod !== "ONLINE" &&
      order.status !== "CANCELLED"
  );
}

function getOrderStatusRank(order: Order) {
  const normalizedStatus = order.statusLabel ?? order.status.toLowerCase();

  if (normalizedStatus === "awaiting_store_confirmation") {
    return 1;
  }

  if (normalizedStatus === "confirmed" || normalizedStatus === "pending") {
    return 2;
  }

  if (normalizedStatus === "accepted") {
    return 3;
  }

  if (normalizedStatus === "picked_up") {
    return 4;
  }

  if (normalizedStatus === "delivered") {
    return 5;
  }

  if (normalizedStatus === "cancelled") {
    return 6;
  }

  return 1;
}

function getOperationalTimeline(order: Order) {
  const isPickup = order.fulfillmentType === "PICKUP";
  const isCancelled = (order.statusLabel ?? order.status).toLowerCase() === "cancelled";
  const rank = getOrderStatusRank(order);
  const steps = [
    {
      key: "received",
      rank: 1,
      title: "Pedido recebido",
      description: "O cliente enviou o pedido para a loja."
    },
    {
      key: "confirmed",
      rank: 2,
      title: "Confirmado",
      description: isPickup
        ? "Retirada confirmada sem taxa de entrega."
        : "Pedido confirmado com taxa de entrega."
    },
    {
      key: "courier",
      rank: 3,
      title: "Com motoboy",
      description: "Um motoboy aprovado aceitou a entrega."
    },
    {
      key: "delivery",
      rank: 4,
      title: isPickup ? "Retirado" : "Saiu para entrega",
      description: "Pedido saiu da loja para finalização."
    },
    {
      key: "delivered",
      rank: 5,
      title: "Entregue",
      description: "Pedido concluído."
    },
    {
      key: "cancelled",
      rank: 6,
      title: "Cancelado",
      description: "Pedido cancelado e registrado no histórico."
    }
  ];

  return steps.map((step) => {
    if (isCancelled && step.key === "cancelled") {
      return { ...step, state: "cancelled" };
    }

    if (isCancelled) {
      return { ...step, state: step.rank <= 1 ? "done" : "upcoming" };
    }

    if (step.rank < rank) {
      return { ...step, state: "done" };
    }

    if (step.rank === rank) {
      return { ...step, state: "active" };
    }

    return { ...step, state: "upcoming" };
  });
}

function canConfirmOrder(order: Order) {
  return Boolean(
    order.clientId &&
      order.status === "PENDING" &&
      !order.storeConfirmedAt &&
      order.statusLabel === "awaiting_store_confirmation"
  );
}

function parseMoneyDraft(value: string) {
  const parsed = Number(value.replace(",", ".") || "0");

  return Number.isFinite(parsed) ? parsed : 0;
}

export function OrdersPage() {
  const { token } = useAuth();
  const { isConnected, subscribeToOrderEvents } = useRealtime();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "accepted" | "picked_up" | "delivered" | "cancelled"
  >("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [history, setHistory] = useState<OrderAuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmModalOrder, setConfirmModalOrder] = useState<Order | null>(null);
  const [deliveryFeeDraft, setDeliveryFeeDraft] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [lastRealtimeAt, setLastRealtimeAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadData();
  }, [token, page, statusFilter]);

  useEffect(() => {
    if (!token) {
      return;
    }

    return subscribeToOrderEvents(() => {
      setLastRealtimeAt(new Date());
      void loadData({ silent: true });

      if (selectedOrderId) {
        void loadHistory(selectedOrderId, { silent: true });
      }
    });
  }, [selectedOrderId, subscribeToOrderEvents, token, page, statusFilter]);

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

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  async function loadData(options?: { silent?: boolean }) {
    if (!token) {
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const [ordersResponse, productsResponse] = await Promise.all([
        ordersService.list(token, {
          page,
          limit: 8,
          status: statusFilter === "all" ? undefined : statusFilter
        }),
        productsService.list(token)
      ]);
      setOrders(ordersResponse.items);
      setTotalPages(ordersResponse.meta.totalPages);
      setProducts(productsResponse.filter((product) => product.available));
      setSelectedOrderId((current) => {
        if (!ordersResponse.items.length) {
          return null;
        }

        if (current && ordersResponse.items.some((order) => order.id === current)) {
          return current;
        }

        return ordersResponse.items[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Não foi possível carregar pedidos e produtos."
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!token || !selectedOrderId) {
      setHistory([]);
      return;
    }

    void loadHistory(selectedOrderId);
  }, [selectedOrderId, token]);

  async function loadHistory(orderId: string, options?: { silent?: boolean }) {
    if (!token) {
      return;
    }

    if (!options?.silent) {
      setHistoryLoading(true);
    }

    try {
      const response = await ordersService.history(token, orderId);
      setHistory(response);
    } catch (historyError) {
      setError(
        historyError instanceof ApiError
          ? historyError.message
          : "Não foi possível carregar o histórico do pedido."
      );
    } finally {
      if (!options?.silent) {
        setHistoryLoading(false);
      }
    }
  }

  async function handleCreateOrder(input: CreateOrderInput) {
    if (!token) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const createdOrder = await ordersService.create(token, input);
      setSuccessMessage("Pedido criado com sucesso.");
      await loadData();
      setSelectedOrderId(createdOrder.id);
    } catch (submitError) {
      setFormError(
        submitError instanceof ApiError
          ? submitError.message
          : "Não foi possível criar o pedido."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openCancelModal(order: Order) {
    setCancelModalOrder(order);
    setCancelReasonDraft(order.cancelReason ?? "");
    setCancelError(null);
    setError(null);
  }

  function openConfirmModal(order: Order) {
    setConfirmModalOrder(order);
    setDeliveryFeeDraft(
      order.fulfillmentType === "PICKUP"
        ? "0"
        : (order.suggestedDeliveryFee ?? order.deliveryFee).toFixed(2)
    );
    setConfirmError(null);
    setError(null);
  }

  function openPaymentModal(order: Order) {
    setPaymentModalOrder(order);
    setPaymentError(null);
    setError(null);
  }

  function closeCancelModal() {
    if (actingOrderId) {
      return;
    }

    setCancelModalOrder(null);
    setCancelReasonDraft("");
    setCancelError(null);
  }

  function closeConfirmModal() {
    if (actingOrderId) {
      return;
    }

    setConfirmModalOrder(null);
    setDeliveryFeeDraft("");
    setConfirmError(null);
  }

  function closePaymentModal() {
    if (actingOrderId) {
      return;
    }

    setPaymentModalOrder(null);
    setPaymentError(null);
  }

  async function handleConfirmOrder() {
    if (!token || !confirmModalOrder) {
      return;
    }

    const deliveryFee = parseMoneyDraft(deliveryFeeDraft);

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      setConfirmError("Informe uma taxa de entrega válida.");
      return;
    }

    setActingOrderId(confirmModalOrder.id);
    setConfirmError(null);
    setError(null);

    try {
      const confirmedOrder = await ordersService.confirm(token, confirmModalOrder.id, {
        deliveryFee
      });
      setSuccessMessage("Pedido confirmado com sucesso.");
      setSelectedOrderId(confirmedOrder.id);
      setConfirmModalOrder(null);
      setDeliveryFeeDraft("");
      await loadData({ silent: true });
      await loadHistory(confirmedOrder.id, { silent: true });
    } catch (confirmRequestError) {
      const message =
        confirmRequestError instanceof ApiError
          ? confirmRequestError.message
          : "Não foi possível confirmar o pedido.";

      setError(message);
      setConfirmError(message);
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleConfirmCancel() {
    if (!token || !cancelModalOrder) {
      return;
    }

    const trimmedReason = cancelReasonDraft.trim();
    setActingOrderId(cancelModalOrder.id);
    setCancelError(null);
    setError(null);

    try {
      const cancelledOrder = await ordersService.cancel(token, cancelModalOrder.id, {
        reason: trimmedReason || undefined
      });
      setSuccessMessage("Pedido cancelado com sucesso.");

      if (statusFilter !== "all") {
        setStatusFilter("all");
        setPage(1);
      }

      setSelectedOrderId(cancelledOrder.id);
      setCancelModalOrder(null);
      setCancelReasonDraft("");
      await loadData({ silent: true });
      await loadHistory(cancelledOrder.id, { silent: true });
    } catch (cancelRequestError) {
      const message =
        cancelRequestError instanceof ApiError
          ? cancelRequestError.message
          : "Não foi possível cancelar o pedido.";

      setError(message);
      setCancelError(message);
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleMarkPaymentPaid() {
    if (!token || !paymentModalOrder) {
      return;
    }

    setActingOrderId(paymentModalOrder.id);
    setPaymentError(null);
    setError(null);

    try {
      const paidOrder = await ordersService.markPaymentPaid(token, paymentModalOrder.id);
      setSuccessMessage("Pagamento marcado como pago.");
      setSelectedOrderId(paidOrder.id);
      setPaymentModalOrder(null);
      await loadData({ silent: true });
      await loadHistory(paidOrder.id, { silent: true });
    } catch (paymentRequestError) {
      const message =
        paymentRequestError instanceof ApiError
          ? paymentRequestError.message
          : "Não foi possível marcar o pagamento como pago.";

      setError(message);
      setPaymentError(message);
    } finally {
      setActingOrderId(null);
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Pedidos"
        description="Crie pedidos manualmente e acompanhe a fila da loja com status e histórico em tempo real."
        action={
          <div className="orders-page-actions">
            <span className={`status-chip ${isConnected ? "live" : "offline"}`}>
              {isConnected ? "Tempo real ativo" : "Tempo real offline"}
            </span>
            {lastRealtimeAt ? (
              <span className="status-chip live">
                Atualizado às {lastRealtimeAt.toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
            <select
              className="filter-select"
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as typeof statusFilter);
              }}
              value={statusFilter}
            >
              <option value="all">Todos os status</option>
              <option value="pending">Pendente</option>
              <option value="accepted">Aceito</option>
              <option value="picked_up">Em entrega</option>
              <option value="delivered">Entregue</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        }
      />

      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      <div className="orders-grid">
        <OrderForm
          error={formError}
          onSubmit={handleCreateOrder}
          products={products}
          submitting={submitting}
        />

        <div className="panel">
          <div className="panel-heading">
            <h3>Lista de pedidos</h3>
            <div className="pagination-controls">
              <button
                className="ghost-button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                className="ghost-button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) =>
                    current < totalPages ? current + 1 : current
                  )
                }
                type="button"
              >
                Próxima
              </button>
            </div>
          </div>

          {error ? <div className="feedback feedback-error">{error}</div> : null}

          {loading ? (
            <div className="screen-state">Carregando pedidos...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              Nenhum pedido por aqui ainda. Crie o primeiro para iniciar a operação.
            </div>
          ) : (
            <div className="stack-list">
              {orders.map((order) => (
                <article
                  className={`order-card ${selectedOrderId === order.id ? "order-card-selected" : ""}`}
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="order-card-head">
                    <div>
                      <strong>{order.customerName}</strong>
                      <p>{order.customerPhone}</p>
                    </div>
                    <span className="pill">
                      {formatOrderStatus(order.status, order.statusLabel)}
                    </span>
                  </div>

                  <p className="muted-text">{formatFulfillmentType(order)}</p>
                  <p>{order.customerAddress}</p>
                  <p className="muted-text">
                    Pagamento: {formatPaymentMethod(order.paymentMethod)} ·{" "}
                    {formatPaymentStatus(order.paymentStatus)}
                  </p>

                  <ul className="order-items">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.quantity}x {item.nameSnapshot}
                        </span>
                        <strong>R$ {item.totalPrice.toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="order-totals">
                    <span>Subtotal: R$ {order.subtotal.toFixed(2)}</span>
                    <span>Entrega: R$ {order.deliveryFee.toFixed(2)}</span>
                    <strong>Total: R$ {order.total.toFixed(2)}</strong>
                  </div>

                  {order.cancelReason ? (
                    <div className="feedback feedback-warning">
                      Motivo do cancelamento: {order.cancelReason}
                    </div>
                  ) : null}

                  {canConfirmOrder(order) ? (
                    <button
                      className="primary-button"
                      disabled={actingOrderId === order.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openConfirmModal(order);
                      }}
                      type="button"
                    >
                      Confirmar pedido
                    </button>
                  ) : null}

                  {canMarkPaymentPaid(order) ? (
                    <button
                      className="secondary-button"
                      disabled={actingOrderId === order.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openPaymentModal(order);
                      }}
                      type="button"
                    >
                      Marcar pagamento como pago
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h3>Detalhe e histórico</h3>
            <div className="orders-page-actions">
              {selectedOrder && canConfirmOrder(selectedOrder) ? (
                <button
                  className="primary-button"
                  disabled={actingOrderId === selectedOrder.id}
                  onClick={() => openConfirmModal(selectedOrder)}
                  type="button"
                >
                  Confirmar pedido
                </button>
              ) : null}
              {selectedOrder &&
            selectedOrder.status !== "DELIVERED" &&
            selectedOrder.status !== "CANCELLED" ? (
              <button
                className="danger-button"
                disabled={actingOrderId === selectedOrder.id}
                onClick={() => openCancelModal(selectedOrder)}
                type="button"
              >
                {actingOrderId === selectedOrder.id ? "Cancelando..." : "Cancelar pedido"}
              </button>
              ) : null}
              {selectedOrder && canMarkPaymentPaid(selectedOrder) ? (
                <button
                  className="secondary-button"
                  disabled={actingOrderId === selectedOrder.id}
                  onClick={() => openPaymentModal(selectedOrder)}
                  type="button"
                >
                  Marcar pagamento como pago
                </button>
              ) : null}
            </div>
          </div>

          {!selectedOrder ? (
            <div className="empty-state">
              Selecione um pedido para ver histórico, motivo de cancelamento e contexto da entrega.
            </div>
          ) : (
            <div className="order-detail-stack">
              <div className="order-detail-card">
                <div className="order-card-head">
                  <div>
                    <strong>{selectedOrder.customerName}</strong>
                    <p>{selectedOrder.customerPhone}</p>
                  </div>
                  <span className="pill">
                    {formatOrderStatus(selectedOrder.status, selectedOrder.statusLabel)}
                  </span>
                </div>
                <p className="muted-text">{formatFulfillmentType(selectedOrder)}</p>
                <p>{selectedOrder.customerAddress}</p>
                <p className="muted-text">
                  Status atual: {formatOrderStatus(selectedOrder.status, selectedOrder.statusLabel)}
                </p>
                <p className="muted-text">
                  Pagamento: {formatPaymentMethod(selectedOrder.paymentMethod)} ·{" "}
                  {formatPaymentStatus(selectedOrder.paymentStatus)}
                  {selectedOrder.paidAt
                    ? ` em ${new Date(selectedOrder.paidAt).toLocaleString("pt-BR")}`
                    : ""}
                </p>
                {selectedOrder.courier ? (
                  <p className="muted-text">
                    Motoboy: {selectedOrder.courier.name} · {selectedOrder.courier.phone}
                  </p>
                ) : (
                  <p className="muted-text">Motoboy: ainda não atribuído</p>
                )}
                {selectedOrder.addressReference ? (
                  <p className="muted-text">Referência: {selectedOrder.addressReference}</p>
                ) : null}
                {selectedOrder.notes ? (
                  <p className="muted-text">Observações: {selectedOrder.notes}</p>
                ) : null}
                <div className="order-totals">
                  <span>Subtotal: R$ {selectedOrder.subtotal.toFixed(2)}</span>
                  <span>Entrega: R$ {selectedOrder.deliveryFee.toFixed(2)}</span>
                  <strong>Total: R$ {selectedOrder.total.toFixed(2)}</strong>
                </div>
                {selectedOrder.cancelReason ? (
                  <div className="feedback feedback-warning">
                    Cancelado com motivo: {selectedOrder.cancelReason}
                  </div>
                ) : null}
              </div>

              <div className="order-detail-card">
                <p className="section-kicker">Linha do tempo operacional</p>
                <div className="timeline timeline-operational">
                  {getOperationalTimeline(selectedOrder).map((step) => (
                    <article
                      className={`timeline-item timeline-item-${step.state}`}
                      key={step.key}
                    >
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <strong>{step.title}</strong>
                        <p>{step.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="timeline">
                {historyLoading ? (
                  <div className="screen-state">Carregando histórico...</div>
                ) : history.length === 0 ? (
                  <div className="empty-state">
                    Nenhum evento registrado para este pedido ainda.
                  </div>
                ) : (
                  history.map((event) => (
                    <article className="timeline-item" key={event.id}>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <strong>{formatAuditType(event.type)}</strong>
                        <p>
                          {event.actorName
                            ? `${event.actorName} (${formatActorRole(event.actorRole)})`
                            : "Sistema"}
                        </p>
                        {event.reason ? <p>Motivo: {event.reason}</p> : null}
                        <span>{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmModalOrder ? (
        <div className="modal-backdrop" onClick={closeConfirmModal} role="presentation">
          <div
            aria-labelledby="confirm-order-title"
            aria-modal="true"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Revisão da loja</p>
                <h3 id="confirm-order-title">Confirmar pedido</h3>
              </div>
              <button
                className="ghost-button"
                disabled={Boolean(actingOrderId)}
                onClick={closeConfirmModal}
                type="button"
              >
                Fechar
              </button>
            </div>

            <p className="muted-text">
              Revise o pedido de <strong>{confirmModalOrder.customerName}</strong>.
              Para retirada, a taxa fica zerada. Para entrega, informe a taxa antes de confirmar.
            </p>

            <div className="order-totals">
              <span>Subtotal: R$ {confirmModalOrder.subtotal.toFixed(2)}</span>
              <span>
                Entrega: R$ {parseMoneyDraft(deliveryFeeDraft).toFixed(2)}
              </span>
              <strong>
                Total: R${" "}
                {(confirmModalOrder.subtotal + parseMoneyDraft(deliveryFeeDraft)).toFixed(2)}
              </strong>
            </div>

            {confirmModalOrder.fulfillmentType === "DELIVERY" ? (
              <div className="delivery-fee-panel">
                {confirmModalOrder.suggestedDeliveryFee !== null &&
                confirmModalOrder.suggestedDeliveryFee !== undefined ? (
                  <div className="feedback feedback-success">
                    Taxa sugerida para o bairro: R${" "}
                    {confirmModalOrder.suggestedDeliveryFee.toFixed(2)}. Ajuste se
                    necessario antes de confirmar.
                  </div>
                ) : (
                  <div className="feedback feedback-warning">
                    Sem taxa sugerida para este bairro. Informe a taxa manualmente.
                  </div>
                )}
                <label className="field">
                  <span>Taxa de entrega</span>
                  <input
                    disabled={Boolean(actingOrderId)}
                    min="0"
                    onChange={(event) => setDeliveryFeeDraft(event.target.value)}
                    placeholder="Ex.: 8,00"
                    step="0.01"
                    type="number"
                    value={deliveryFeeDraft}
                  />
                </label>
                <div className="fee-suggestions">
                  {[5, 8, 10, 12].map((value) => (
                    <button
                      className="ghost-button"
                      disabled={Boolean(actingOrderId)}
                      key={value}
                      onClick={() => setDeliveryFeeDraft(value.toFixed(2))}
                      type="button"
                    >
                      R$ {value.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="feedback feedback-success">
                Pedido marcado para retirada na loja. Nenhuma taxa de entrega será cobrada.
              </div>
            )}

            {confirmError ? <div className="feedback feedback-error">{confirmError}</div> : null}

            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={Boolean(actingOrderId)}
                onClick={closeConfirmModal}
                type="button"
              >
                Voltar
              </button>
              <button
                className="primary-button"
                disabled={Boolean(actingOrderId)}
                onClick={() => void handleConfirmOrder()}
                type="button"
              >
                {actingOrderId === confirmModalOrder.id ? "Confirmando..." : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModalOrder ? (
        <div className="modal-backdrop" onClick={closePaymentModal} role="presentation">
          <div
            aria-labelledby="payment-order-title"
            aria-modal="true"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Pagamento manual</p>
                <h3 id="payment-order-title">Marcar como pago</h3>
              </div>
              <button
                className="ghost-button"
                disabled={Boolean(actingOrderId)}
                onClick={closePaymentModal}
                type="button"
              >
                Fechar
              </button>
            </div>

            <p className="muted-text">
              Confirme apenas se a loja recebeu o pagamento manual do pedido de{" "}
              <strong>{paymentModalOrder.customerName}</strong>.
            </p>

            <div className="order-totals">
              <span>Método: {formatPaymentMethod(paymentModalOrder.paymentMethod)}</span>
              <span>Status atual: {formatPaymentStatus(paymentModalOrder.paymentStatus)}</span>
              <strong>Total: R$ {paymentModalOrder.total.toFixed(2)}</strong>
            </div>

            <div className="feedback feedback-warning">
              Esta ação registra o pagamento como pago no histórico do pedido. Integração Pix
              automática ainda não está ativa.
            </div>

            {paymentError ? <div className="feedback feedback-error">{paymentError}</div> : null}

            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={Boolean(actingOrderId)}
                onClick={closePaymentModal}
                type="button"
              >
                Voltar
              </button>
              <button
                className="primary-button"
                disabled={Boolean(actingOrderId)}
                onClick={() => void handleMarkPaymentPaid()}
                type="button"
              >
                {actingOrderId === paymentModalOrder.id
                  ? "Registrando..."
                  : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelModalOrder ? (
        <div className="modal-backdrop" onClick={closeCancelModal} role="presentation">
          <div
            aria-labelledby="cancel-order-title"
            aria-modal="true"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="section-kicker">Confirmação</p>
                <h3 id="cancel-order-title">Cancelar pedido</h3>
              </div>
              <button
                className="ghost-button"
                disabled={Boolean(actingOrderId)}
                onClick={closeCancelModal}
                type="button"
              >
                Fechar
              </button>
            </div>

            <p className="muted-text">
              Você está cancelando o pedido de <strong>{cancelModalOrder.customerName}</strong>.
              Essa ação remove o pedido da operação do motoboy e registra o evento no histórico.
            </p>

            <label className="field">
              <span>Motivo do cancelamento</span>
              <textarea
                disabled={Boolean(actingOrderId)}
                maxLength={300}
                onChange={(event) => setCancelReasonDraft(event.target.value)}
                placeholder="Opcional. Ex.: cliente desistiu, endereço incorreto, item indisponível."
                rows={4}
                value={cancelReasonDraft}
              />
            </label>

            {cancelError ? <div className="feedback feedback-error">{cancelError}</div> : null}

            <div className="modal-actions">
              <button
                className="secondary-button"
                disabled={Boolean(actingOrderId)}
                onClick={closeCancelModal}
                type="button"
              >
                Voltar
              </button>
              <button
                className="danger-button"
                disabled={Boolean(actingOrderId)}
                onClick={() => void handleConfirmCancel()}
                type="button"
              >
                {actingOrderId === cancelModalOrder.id ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
