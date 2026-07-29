import { useEffect, useState, type FormEvent } from "react";

const apiUrl = (
  import.meta.env.VITE_STORE_API_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000/api"
).replace(/\/+$/, "");

type FulfillmentType = "DELIVERY" | "PICKUP";
type PaymentMethod = "CASH" | "CARD_ON_DELIVERY" | "PIX_MANUAL" | "ONLINE";

interface PublicProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  availabilityLabel: string;
}

interface PublicStoreResponse {
  status: "OPEN" | "UNAVAILABLE";
  message?: string;
  store: {
    name: string;
    slug: string;
    address?: string;
    description?: string | null;
    imageUrl?: string | null;
    pickupEnabled: boolean;
    businessHoursNote?: string | null;
    estimatedWindow?: {
      preparationMinutes: number;
      deliveryMinMinutes: number;
      deliveryMaxMinutes: number;
    };
  };
  paymentOptions?: { methods: PaymentMethod[] };
  deliveryZones?: Array<{ district: string; name: string; fee: number }>;
  categories?: string[];
  products?: PublicProduct[];
}

interface PublicOrder {
  publicOrderCode?: string | null;
  status: string;
  statusLabel: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  fulfillmentType: FulfillmentType;
  store: { name: string; slug: string };
  customer: { name: string; phone: string };
  address: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  pixPaymentInstructions?: {
    pixKeyType: string;
    pixKey: string;
    pixRecipientName: string;
    pixInstructions: string;
  } | null;
  automaticPixPayment?: {
    status: string;
    amount: number;
    qrCodeText?: string | null;
    qrCodeImageUrl?: string | null;
    expiresAt?: string | null;
    paidAt?: string | null;
  } | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  timeline: Array<{ type: string; label: string; createdAt: string }>;
  createdAt: string;
}

interface CartItem {
  product: PublicProduct;
  quantity: number;
}

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  addressZipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressDistrict: string;
  addressComplement: string;
  addressCity: string;
  addressState: string;
  addressReference: string;
  paymentMethod: PaymentMethod;
  payerDocument: string;
  notes: string;
}

const initialCheckoutForm: CheckoutForm = {
  customerName: "",
  customerPhone: "",
  fulfillmentType: "DELIVERY",
  addressZipCode: "",
  addressStreet: "",
  addressNumber: "",
  addressDistrict: "",
  addressComplement: "",
  addressCity: "",
  addressState: "",
  addressReference: "",
  paymentMethod: "CASH",
  payerDocument: "",
  notes: ""
};

export function App() {
  const route = parseRoute();

  if (route.kind === "order") {
    return <TrackingPage token={route.token} />;
  }

  if (route.kind === "store") {
    return <StorePage slug={route.slug} />;
  }

  return (
    <main className="page-center">
      <section className="state-card">
        <span className="brand-chip">Mototake Loja</span>
        <h1>Link de loja nao encontrado</h1>
        <p>Abra o link enviado pela empresa para ver o catalogo.</p>
      </section>
    </main>
  );
}

function StorePage({ slug }: { slug: string }) {
  const [storeData, setStoreData] = useState<PublicStoreResponse | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(slug));
  const [form, setForm] = useState<CheckoutForm>(initialCheckoutForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const products = storeData?.products ?? [];
  const categories = storeData?.categories ?? [];
  const subtotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
  const selectedZone = storeData?.deliveryZones?.find(
    (zone) =>
      normalize(zone.district) === normalize(form.addressDistrict) ||
      normalize(zone.name) === normalize(form.addressDistrict)
  );
  const deliveryFee = form.fulfillmentType === "PICKUP" ? 0 : selectedZone?.fee;
  const total = subtotal + (deliveryFee ?? 0);
  const availablePaymentMethods = storeData?.paymentOptions?.methods ?? ["CASH", "CARD_ON_DELIVERY"];

  useEffect(() => {
    void loadStore();
  }, [slug]);

  useEffect(() => {
    window.localStorage.setItem(cartKey(slug), JSON.stringify(cart));
  }, [cart, slug]);

  async function loadStore() {
    setLoading(true);
    setError(null);

    try {
      setStoreData(await request<PublicStoreResponse>(`/storefront/stores/${slug}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar a loja.");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: PublicProduct) {
    if (!product.available) {
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { product, quantity: 1 }];
    });
    setSuccess(`${product.name} adicionado ao carrinho.`);
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(1, quantity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (cart.length === 0) {
      setError("Adicione pelo menos um produto ao carrinho.");
      return;
    }

    if (form.fulfillmentType === "DELIVERY" && !selectedZone) {
      setError("Selecione um bairro atendido pela loja.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await request<{ trackingToken: string; order: PublicOrder }>(
        `/storefront/stores/${slug}/checkout`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            customerName: form.customerName.trim(),
            customerPhone: form.customerPhone.trim(),
            fulfillmentType: form.fulfillmentType,
            addressZipCode: form.addressZipCode.trim() || undefined,
            addressStreet: form.addressStreet.trim() || undefined,
            addressNumber: form.addressNumber.trim() || undefined,
            addressDistrict: form.addressDistrict.trim() || undefined,
            addressComplement: form.addressComplement.trim() || undefined,
            addressCity: form.addressCity.trim() || undefined,
            addressState: form.addressState.trim() || undefined,
            addressReference: form.addressReference.trim() || undefined,
            paymentMethod: form.paymentMethod,
            payerDocument: form.payerDocument.trim() || undefined,
            notes: form.notes.trim() || undefined,
            items: cart.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity
            }))
          })
        }
      );

      setCart([]);
      window.location.assign(`/pedido/${response.trackingToken}`);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Nao foi possivel enviar o pedido."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState message="Carregando catalogo..." />;
  }

  if (!storeData || storeData.status !== "OPEN") {
    return (
      <main className="page-center">
        <section className="state-card">
          <span className="brand-chip">Mototake Loja</span>
          <h1>{storeData?.store?.name ?? "Loja indisponivel"}</h1>
          <p>{storeData?.message ?? error ?? "Esta loja nao esta disponivel agora."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="storefront-shell">
      <header className="hero-card">
        <div className="store-avatar">
          {storeData.store.imageUrl ? (
            <img alt={`Imagem de ${storeData.store.name}`} src={toMediaUrl(storeData.store.imageUrl)} />
          ) : (
            <span>{storeData.store.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div>
          <span className="brand-chip">Mototake Loja</span>
          <h1>{storeData.store.name}</h1>
          <p>{storeData.store.description ?? "Catalogo online para pedidos rapidos."}</p>
          <div className="hero-meta">
            <span>{storeData.store.businessHoursNote ?? "Atendimento conforme disponibilidade da loja"}</span>
            <span>
              Preparo medio: {storeData.store.estimatedWindow?.preparationMinutes ?? 25} min
            </span>
          </div>
        </div>
      </header>

      {success ? <div className="feedback success">{success}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}

      <section className="content-grid">
        <div className="catalog-column">
          {categories.map((category) => (
            <section className="catalog-section" key={category}>
              <h2>{category}</h2>
              <div className="product-grid">
                {products
                  .filter((product) => product.category === category)
                  .map((product) => (
                    <article className={!product.available ? "product-card disabled" : "product-card"} key={product.id}>
                      <div className="product-image">
                        {product.imageUrl ? (
                          <img alt={product.name} src={toMediaUrl(product.imageUrl)} />
                        ) : (
                          <span>{product.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="product-copy">
                        <span className={product.available ? "pill success" : "pill muted"}>
                          {product.availabilityLabel}
                        </span>
                        <h3>{product.name}</h3>
                        <p>{product.description ?? "Produto do catalogo da loja."}</p>
                        <strong>{formatCurrency(product.price)}</strong>
                      </div>
                      <button
                        className="primary-button"
                        disabled={!product.available}
                        onClick={() => addToCart(product)}
                        type="button"
                      >
                        {product.available ? "Adicionar" : "Indisponivel"}
                      </button>
                    </article>
                  ))}
              </div>
            </section>
          ))}
          {products.length === 0 ? (
            <div className="state-card">Esta loja ainda nao possui produtos disponiveis.</div>
          ) : null}
        </div>

        <aside className="checkout-card">
          <h2>Carrinho</h2>
          {cart.length === 0 ? (
            <div className="empty-cart">Seu carrinho esta vazio.</div>
          ) : (
            <div className="cart-list">
              {cart.map((item) => (
                <div className="cart-item" key={item.product.id}>
                  <div>
                    <strong>{item.product.name}</strong>
                    <span>{formatCurrency(item.product.price)}</span>
                  </div>
                  <div className="quantity-control">
                    <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="checkout-form" onSubmit={(event) => void handleCheckout(event)}>
            <label>
              <span>Nome</span>
              <input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
            </label>
            <label>
              <span>Telefone</span>
              <input required value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
            </label>
            <label>
              <span>Entrega ou retirada</span>
              <select value={form.fulfillmentType} onChange={(event) => setForm({ ...form, fulfillmentType: event.target.value as FulfillmentType })}>
                <option value="DELIVERY">Entregar no endereco</option>
                {storeData.store.pickupEnabled ? <option value="PICKUP">Retirar na loja</option> : null}
              </select>
            </label>

            {form.fulfillmentType === "DELIVERY" ? (
              <div className="address-grid">
                <label>
                  <span>Bairro atendido</span>
                  <select required value={form.addressDistrict} onChange={(event) => setForm({ ...form, addressDistrict: event.target.value })}>
                    <option value="">Selecione</option>
                    {storeData.deliveryZones?.map((zone) => (
                      <option key={zone.district} value={zone.district}>
                        {zone.district} - {formatCurrency(zone.fee)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Rua</span>
                  <input required value={form.addressStreet} onChange={(event) => setForm({ ...form, addressStreet: event.target.value })} />
                </label>
                <label>
                  <span>Numero</span>
                  <input required value={form.addressNumber} onChange={(event) => setForm({ ...form, addressNumber: event.target.value })} />
                </label>
                <label>
                  <span>Cidade</span>
                  <input required value={form.addressCity} onChange={(event) => setForm({ ...form, addressCity: event.target.value })} />
                </label>
                <label>
                  <span>UF</span>
                  <input maxLength={2} value={form.addressState} onChange={(event) => setForm({ ...form, addressState: event.target.value.toUpperCase() })} />
                </label>
                <label>
                  <span>Complemento</span>
                  <input value={form.addressComplement} onChange={(event) => setForm({ ...form, addressComplement: event.target.value })} />
                </label>
                <label>
                  <span>Referencia</span>
                  <input value={form.addressReference} onChange={(event) => setForm({ ...form, addressReference: event.target.value })} />
                </label>
              </div>
            ) : null}

            <label>
              <span>Forma de pagamento</span>
              <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                {availablePaymentMethods.map((method) => (
                  <option key={method} value={method}>{paymentMethodLabel(method)}</option>
                ))}
              </select>
            </label>
            {form.paymentMethod === "PIX_MANUAL" ? (
              <div className="helper-box">A loja vai confirmar o pagamento manualmente.</div>
            ) : null}
            {form.paymentMethod === "ONLINE" ? (
              <label>
                <span>CPF/CNPJ para Pix automatico</span>
                <input required value={form.payerDocument} onChange={(event) => setForm({ ...form, payerDocument: event.target.value })} />
              </label>
            ) : null}
            <label>
              <span>Observacao</span>
              <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>

            <div className="totals-card">
              <span>Subtotal <strong>{formatCurrency(subtotal)}</strong></span>
              <span>Taxa de entrega <strong>{deliveryFee === undefined ? "Selecione o bairro" : formatCurrency(deliveryFee)}</strong></span>
              <span>Total <strong>{formatCurrency(total)}</strong></span>
            </div>

            <button className="primary-button" disabled={submitting || cart.length === 0} type="submit">
              {submitting ? "Enviando..." : "Enviar pedido"}
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}

function TrackingPage({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        const nextOrder = await request<PublicOrder>(`/storefront/orders/${token}`);
        if (!cancelled) {
          setOrder(nextOrder);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar o pedido.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrder();
    const interval = window.setInterval(() => void loadOrder(), 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  if (loading) {
    return <LoadingState message="Carregando pedido..." />;
  }

  if (!order) {
    return (
      <main className="page-center">
        <section className="state-card">
          <h1>Pedido nao encontrado</h1>
          <p>{error ?? "Confira o link de acompanhamento."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="tracking-shell">
      <section className="hero-card">
        <div>
          <span className="brand-chip">{order.store.name}</span>
          <h1>Pedido {order.publicOrderCode ?? ""}</h1>
          <p>{order.statusLabel}</p>
        </div>
        <span className="pill success">{paymentStatusLabel(order.paymentStatus)}</span>
      </section>

      <section className="tracking-grid">
        <article className="state-card">
          <h2>Resumo</h2>
          <div className="totals-card">
            <span>Subtotal <strong>{formatCurrency(order.subtotal)}</strong></span>
            <span>Taxa <strong>{formatCurrency(order.deliveryFee)}</strong></span>
            <span>Total <strong>{formatCurrency(order.total)}</strong></span>
            <span>Pagamento <strong>{paymentMethodLabel(order.paymentMethod)}</strong></span>
          </div>
          <p className="muted">Entrega: {order.fulfillmentType === "PICKUP" ? "Retirada na loja" : order.address}</p>
        </article>

        {order.pixPaymentInstructions ? (
          <article className="state-card">
            <h2>Pix manual</h2>
            <p>Chave {order.pixPaymentInstructions.pixKeyType}: <strong>{order.pixPaymentInstructions.pixKey}</strong></p>
            <p>Recebedor: {order.pixPaymentInstructions.pixRecipientName}</p>
            <p>{order.pixPaymentInstructions.pixInstructions}</p>
          </article>
        ) : null}

        {order.automaticPixPayment ? (
          <article className="state-card">
            <h2>Pix automatico</h2>
            {order.automaticPixPayment.qrCodeImageUrl ? (
              <img className="payment-qr" alt="QR Code Pix" src={order.automaticPixPayment.qrCodeImageUrl} />
            ) : null}
            {order.automaticPixPayment.qrCodeText ? (
              <button
                className="primary-button"
                onClick={() => navigator.clipboard.writeText(order.automaticPixPayment?.qrCodeText ?? "")}
                type="button"
              >
                Copiar codigo Pix
              </button>
            ) : null}
            <p>Status: {paymentStatusLabel(order.paymentStatus)}</p>
          </article>
        ) : null}

        <article className="state-card">
          <h2>Itens</h2>
          <div className="cart-list">
            {order.items.map((item) => (
              <div className="cart-item" key={`${item.name}-${item.quantity}`}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                </div>
                <strong>{formatCurrency(item.totalPrice)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="state-card">
          <h2>Linha do tempo</h2>
          <div className="timeline">
            {order.timeline.map((event) => (
              <div className="timeline-item" key={`${event.type}-${event.createdAt}`}>
                <span />
                <div>
                  <strong>{event.label}</strong>
                  <p>{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <main className="page-center">
      <section className="state-card">
        <div className="spinner" />
        <p>{message}</p>
      </section>
    </main>
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[]; error?: string } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message ?? payload?.error ?? "Erro inesperado.";

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function parseRoute() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const [, prefix, value] = path.split("/");

  if (prefix === "loja" && value) {
    return { kind: "store" as const, slug: value };
  }

  if (prefix === "pedido" && value) {
    return { kind: "order" as const, token: value };
  }

  return { kind: "unknown" as const };
}

function loadCart(slug: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
    return raw ? JSON.parse(raw) as CartItem[] : [];
  } catch {
    return [];
  }
}

function cartKey(slug: string) {
  return `mototake:storefront-cart:${slug}`;
}

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toMediaUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${apiUrl}${path}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Dinheiro",
    CARD_ON_DELIVERY: "Cartao na entrega",
    PIX_MANUAL: "Pix manual",
    ONLINE: "Pix automatico"
  };

  return labels[method];
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pagamento pendente",
    PAID: "Pagamento confirmado",
    FAILED: "Pagamento falhou",
    CANCELLED: "Pagamento cancelado",
    REFUNDED: "Pagamento estornado"
  };

  return labels[status] ?? status;
}
