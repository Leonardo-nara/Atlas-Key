import { useMemo, useState } from "react";

import type { OrderPaymentMethod, Product } from "../../types/api";
import type { CreateOrderInput } from "./orders-service";

interface OrderFormProps {
  products: Product[];
  submitting: boolean;
  error: string | null;
  onSubmit: (input: CreateOrderInput) => Promise<void>;
}

interface OrderFormItem {
  productId: string;
  quantity: number;
}

const paymentMethodOptions: Array<{
  value: Exclude<OrderPaymentMethod, "ONLINE">;
  label: string;
}> = [
  { value: "CASH", label: "Dinheiro" },
  { value: "CARD_ON_DELIVERY", label: "Cartão na entrega" },
  { value: "PIX_MANUAL", label: "Pix manual" }
];

export function OrderForm({
  products,
  submitting,
  error,
  onSubmit
}: OrderFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(8);
  const [paymentMethod, setPaymentMethod] =
    useState<Exclude<OrderPaymentMethod, "ONLINE">>("CASH");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [items, setItems] = useState<OrderFormItem[]>([
    { productId: "", quantity: 1 }
  ]);

  const enrichedItems = useMemo(
    () =>
      items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return {
          ...item,
          product,
          total: product ? product.price * item.quantity : 0
        };
      }),
    [items, products]
  );

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + deliveryFee;

  function updateItem(index: number, patch: Partial<OrderFormItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function addItem() {
    setItems((current) => [...current, { productId: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (products.length === 0) {
      setLocalError("Cadastre ao menos um produto disponivel antes de criar pedidos.");
      return;
    }

    if (deliveryFee < 0) {
      setLocalError("A taxa de entrega nao pode ser negativa.");
      return;
    }

    const selectedItems = enrichedItems.filter((item) => item.product);

    if (selectedItems.length === 0) {
      setLocalError("Selecione pelo menos um produto para montar o pedido.");
      return;
    }

    await onSubmit({
      customerName,
      customerPhone,
      customerAddress,
      deliveryFee,
      paymentMethod,
      notes: notes.trim() || undefined,
      items: selectedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
    });

    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDeliveryFee(8);
    setPaymentMethod("CASH");
    setNotes("");
    setItems([{ productId: "", quantity: 1 }]);
  }

  return (
    <form className="panel form-grid" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <h3>Novo pedido</h3>
        <button
          className="secondary-button"
          disabled={products.length === 0}
          onClick={addItem}
          type="button"
        >
          Adicionar item
        </button>
      </div>

      {products.length === 0 ? (
        <div className="feedback feedback-warning">
          Nenhum produto disponivel agora. Cadastre ou ative produtos antes de criar pedidos.
        </div>
      ) : null}

      <div className="form-columns">
        <label className="field">
          <span>Cliente</span>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Telefone</span>
          <input
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Endereço</span>
        <input
          value={customerAddress}
          onChange={(event) => setCustomerAddress(event.target.value)}
          required
        />
      </label>

      <div className="stack-list">
        {items.map((item, index) => (
          <div className="inline-card" key={`${index}-${item.productId}`}>
            <label className="field">
              <span>Produto</span>
              <select
                value={item.productId}
                onChange={(event) =>
                  updateItem(index, { productId: event.target.value })
                }
                required
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - R$ {product.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-small">
              <span>Qtd.</span>
              <input
                min="1"
                type="number"
                value={item.quantity}
                onChange={(event) =>
                  updateItem(index, { quantity: Number(event.target.value) })
                }
                required
              />
            </label>

            <button
              className="ghost-button"
              disabled={items.length === 1}
              onClick={() => removeItem(index)}
              type="button"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div className="form-columns">
        <label className="field">
          <span>Taxa de entrega</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={deliveryFee}
            onChange={(event) => setDeliveryFee(Number(event.target.value))}
            required
          />
        </label>

        <label className="field">
          <span>Forma de pagamento</span>
          <select
            onChange={(event) =>
              setPaymentMethod(event.target.value as Exclude<OrderPaymentMethod, "ONLINE">)
            }
            required
            value={paymentMethod}
          >
            {paymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {paymentMethod === "PIX_MANUAL" ? (
        <div className="feedback feedback-warning">
          A loja confirmará o pagamento manualmente. Nenhum QR Code ou Pix automático
          será gerado nesta etapa.
        </div>
      ) : null}

      <label className="field">
        <span>Observações</span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Opcional"
        />
      </label>

      <div className="order-summary">
        <div>
          <span>Subtotal</span>
          <strong>R$ {subtotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>R$ {deliveryFee.toFixed(2)}</strong>
        </div>
        <div>
          <span>Total estimado</span>
          <strong>R$ {total.toFixed(2)}</strong>
        </div>
      </div>

      {localError || error ? (
        <div className="feedback feedback-error">{localError ?? error}</div>
      ) : null}

      <button
        className="primary-button"
        disabled={submitting || products.length === 0}
        type="submit"
      >
        {submitting ? "Enviando..." : "Criar pedido"}
      </button>
    </form>
  );
}
