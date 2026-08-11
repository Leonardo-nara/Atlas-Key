import { useEffect, useMemo, useState, type FormEvent } from "react";

const apiUrl = (
  import.meta.env.VITE_STORE_API_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000/api"
).replace(/\/+$/, "");

type FulfillmentType = "DELIVERY" | "PICKUP";
type PaymentMethod =
  | "CASH"
  | "CARD_DEBIT_ON_DELIVERY"
  | "CARD_CREDIT_ON_DELIVERY"
  | "PIX_MANUAL"
  | "ONLINE";

interface PublicProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  featured?: boolean;
  availabilityLabel: string;
}

interface StorefrontPaymentOption {
  value: PaymentMethod;
  label: string;
  orderPaymentMethod: "CASH" | "CARD_ON_DELIVERY" | "PIX_MANUAL" | "ONLINE";
}

interface StorefrontOpeningHour {
  dayOfWeek: number;
  closed: boolean;
  openTime?: string;
  closeTime?: string;
}

interface PublicStoreResponse {
  status: "OPEN" | "UNAVAILABLE";
  message?: string;
  store: {
    name: string;
    slug: string;
    address?: string;
    addressComplement?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressZipCode?: string | null;
    phone?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    pickupEnabled: boolean;
    businessHoursNote?: string | null;
    minimumOrder?: number;
    openingHours?: StorefrontOpeningHour[];
    availability?: {
      openNow: boolean;
      orderAllowed: boolean;
      label: string;
      message: string;
    };
    estimatedWindow?: {
      preparationMinutes: number;
      deliveryMinMinutes: number;
      deliveryMaxMinutes: number;
    };
  };
  paymentOptions?: { methods: PaymentMethod[]; options?: StorefrontPaymentOption[] };
  deliveryZones?: Array<{ district: string; name: string; fee: number }>;
  categories?: string[];
  featuredProducts?: PublicProduct[];
  products?: PublicProduct[];
}

interface PublicOrder {
  publicOrderCode?: string | null;
  status: string;
  statusLabel: string;
  paymentMethod: "CASH" | "CARD_ON_DELIVERY" | "PIX_MANUAL" | "ONLINE";
  paymentMethodLabel?: string;
  paymentStatus: string;
  fulfillmentType: FulfillmentType;
  store: { name: string; slug: string };
  customer: { name: string; phone: string };
  address: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  cashChangeNeeded?: boolean;
  cashChangeFor?: number | null;
  notes?: string | null;
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
  items: Array<{
    name: string;
    quantity: number;
    notes?: string | null;
    unitPrice: number;
    totalPrice: number;
  }>;
  timeline: Array<{ type: string; label: string; createdAt: string }>;
  createdAt: string;
}

interface CartItem {
  product: PublicProduct;
  quantity: number;
  notes?: string;
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
  cashChangeFor: string;
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
  cashChangeFor: "",
  notes: ""
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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
        <p>Abra o link enviado pela empresa para ver o cardapio.</p>
      </section>
    </main>
  );
}

function StorePage({ slug }: { slug: string }) {
  const [storeData, setStoreData] = useState<PublicStoreResponse | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(slug));
  const [form, setForm] = useState<CheckoutForm>(() => loadSavedCustomer(slug));
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedNotes, setSelectedNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const products = storeData?.products ?? [];
  const categories = storeData?.categories ?? [];
  const featuredProducts = storeData?.featuredProducts ?? [];
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
  const minimumOrder = storeData?.store.minimumOrder ?? 0;
  const missingMinimum = Math.max(0, minimumOrder - subtotal);
  const availablePaymentMethods = storeData?.paymentOptions?.options ?? [
    { value: "CASH", label: "Dinheiro", orderPaymentMethod: "CASH" },
    {
      value: "CARD_DEBIT_ON_DELIVERY",
      label: "Cartao de debito na entrega",
      orderPaymentMethod: "CARD_ON_DELIVERY"
    }
  ];
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "todos" ||
        activeCategory === "destaques" && product.featured ||
        product.category === activeCategory;
      const normalizedSearch = normalize(searchTerm);
      const matchesSearch =
        !normalizedSearch ||
        normalize(product.name).includes(normalizedSearch) ||
        normalize(product.description).includes(normalizedSearch) ||
        normalize(product.category).includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, searchTerm]);
  const canCheckout =
    cart.length > 0 &&
    missingMinimum === 0 &&
    storeData?.store.availability?.orderAllowed !== false &&
    (form.fulfillmentType === "PICKUP" || Boolean(selectedZone));

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
      const nextStore = await request<PublicStoreResponse>(`/storefront/stores/${slug}`);
      setStoreData(nextStore);
      const firstMethod =
        nextStore.paymentOptions?.options?.[0]?.value ?? nextStore.paymentOptions?.methods?.[0];
      if (firstMethod) {
        setForm((current) => ({ ...current, paymentMethod: firstMethod }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar a loja.");
    } finally {
      setLoading(false);
    }
  }

  function openProduct(product: PublicProduct) {
    if (!product.available) {
      setError(`${product.name} esta indisponivel no momento.`);
      return;
    }

    setSelectedProduct(product);
    setSelectedQuantity(1);
    setSelectedNotes("");
  }

  function addToCart(product: PublicProduct, quantity = 1, notes = "") {
    if (!product.available) {
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id && (item.notes ?? "") === notes.trim()
      );
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id && (item.notes ?? "") === notes.trim()
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...current, { product, quantity, notes: notes.trim() || undefined }];
    });
    setSelectedProduct(null);
    setSuccess(`${product.name} adicionado ao carrinho.`);
  }

  function updateQuantity(productId: string, notes: string | undefined, quantity: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId && (item.notes ?? "") === (notes ?? "")
            ? { ...item, quantity }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCheckout) {
      setError(buildCheckoutBlockMessage(missingMinimum, form.fulfillmentType, selectedZone));
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
            cashChangeFor:
              form.paymentMethod === "CASH" && form.cashChangeFor.trim()
                ? Number(form.cashChangeFor)
                : undefined,
            notes: form.notes.trim() || undefined,
            items: cart.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              notes: item.notes
            }))
          })
        }
      );

      saveCustomer(slug, form);
      setCart([]);
      window.localStorage.removeItem(cartKey(slug));
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

  function clearSavedCustomer() {
    window.localStorage.removeItem(customerKey(slug));
    setForm((current) => ({
      ...initialCheckoutForm,
      paymentMethod: current.paymentMethod
    }));
    setSuccess("Dados salvos neste aparelho foram removidos.");
  }

  async function shareStore() {
    const url = window.location.href;
    const text = `Faca seu pedido pelo cardapio online da ${storeData?.store.name ?? "loja"}:`;

    if (navigator.share) {
      await navigator.share({ title: storeData?.store.name, text, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    setSuccess("Link copiado para compartilhar.");
  }

  if (loading) {
    return <LoadingState message="Carregando cardapio..." />;
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
      <header className="store-hero">
        <div className="store-cover" />
        <div className="store-hero-content">
          <div className="store-avatar">
            {storeData.store.imageUrl ? (
              <img alt={`Imagem de ${storeData.store.name}`} src={toMediaUrl(storeData.store.imageUrl)} />
            ) : (
              <span>{storeData.store.name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="store-heading">
            <span className="brand-chip">Mototake Loja</span>
            <h1>{storeData.store.name}</h1>
            <p>{storeData.store.description ?? "Cardapio online para pedidos rapidos."}</p>
            <div className="hero-meta">
              <span className={storeData.store.availability?.openNow ? "status-open" : "status-closed"}>
                {storeData.store.availability?.label ?? "Aberto agora"}
              </span>
              <span>
                {minimumOrder > 0
                  ? `Pedido minimo ${formatCurrency(minimumOrder)}`
                  : "Sem pedido minimo"}
              </span>
              <span>
                Preparo medio: {storeData.store.estimatedWindow?.preparationMinutes ?? 25} min
              </span>
            </div>
          </div>
          <button className="ghost-button" onClick={() => void shareStore()} type="button">
            Compartilhar
          </button>
        </div>
      </header>

      <nav className="quick-actions" aria-label="Acoes da loja">
        <a href="#catalogo">Cardapio</a>
        <a href="#carrinho">Carrinho</a>
        <a href="#perfil">Perfil da loja</a>
      </nav>

      {success ? <div className="feedback success">{success}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}
      {storeData.store.availability?.orderAllowed === false ? (
        <div className="feedback warning">{storeData.store.availability.message}</div>
      ) : null}

      <section className="search-card" id="catalogo">
        <label>
          <span>Buscar no cardapio</span>
          <input
            placeholder="Produto, descricao ou categoria"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </section>

      <div className="category-strip">
        <button
          className={activeCategory === "todos" ? "active" : ""}
          onClick={() => setActiveCategory("todos")}
          type="button"
        >
          Todos
        </button>
        {featuredProducts.length > 0 ? (
          <button
            className={activeCategory === "destaques" ? "active" : ""}
            onClick={() => setActiveCategory("destaques")}
            type="button"
          >
            Destaques
          </button>
        ) : null}
        {categories.map((category) => (
          <button
            className={activeCategory === category ? "active" : ""}
            key={category}
            onClick={() => setActiveCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      <section className="content-grid">
        <div className="catalog-column">
          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className={!product.available ? "product-card disabled" : "product-card"} key={product.id}>
                  <button className="product-image" onClick={() => openProduct(product)} type="button">
                    {product.imageUrl ? (
                      <img alt={product.name} src={toMediaUrl(product.imageUrl)} />
                    ) : (
                      <span>{product.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </button>
                  <div className="product-copy">
                    <span className={product.available ? "pill success" : "pill muted"}>
                      {product.availabilityLabel}
                    </span>
                    <h3>{product.name}</h3>
                    <p>{product.description ?? "Produto do cardapio da loja."}</p>
                    <strong>{formatCurrency(product.price)}</strong>
                  </div>
                  <button
                    className="primary-button"
                    disabled={!product.available || storeData.store.availability?.orderAllowed === false}
                    onClick={() => openProduct(product)}
                    type="button"
                  >
                    {product.available ? "Escolher" : "Indisponivel"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="state-card">Nenhum produto encontrado para esta busca.</div>
          )}
        </div>

        <aside className="checkout-card" id="carrinho">
          <h2>Carrinho</h2>
          {cart.length === 0 ? (
            <div className="empty-cart">Seu carrinho esta vazio.</div>
          ) : (
            <div className="cart-list">
              {cart.map((item) => (
                <div className="cart-item" key={`${item.product.id}-${item.notes ?? ""}`}>
                  <div>
                    <strong>{item.product.name}</strong>
                    <span>{formatCurrency(item.product.price)}</span>
                    {item.notes ? <small>{item.notes}</small> : null}
                  </div>
                  <div className="quantity-control">
                    <button type="button" onClick={() => updateQuantity(item.product.id, item.notes, item.quantity - 1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.product.id, item.notes, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="checkout-form" onSubmit={(event) => void handleCheckout(event)}>
            <div className="form-section-title">Identificacao</div>
            <label>
              <span>Nome</span>
              <input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
            </label>
            <label>
              <span>WhatsApp / telefone</span>
              <input required value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
            </label>

            <div className="form-section-title">Entrega</div>
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
                  <span>Bairro</span>
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
                  <span>CEP</span>
                  <input value={form.addressZipCode} onChange={(event) => setForm({ ...form, addressZipCode: event.target.value })} />
                </label>
                <label>
                  <span>Complemento</span>
                  <input value={form.addressComplement} onChange={(event) => setForm({ ...form, addressComplement: event.target.value })} />
                </label>
                <label>
                  <span>Ponto de referencia</span>
                  <input value={form.addressReference} onChange={(event) => setForm({ ...form, addressReference: event.target.value })} />
                </label>
              </div>
            ) : null}

            <div className="saved-actions">
              <button className="ghost-button" onClick={clearSavedCustomer} type="button">
                Limpar dados salvos
              </button>
            </div>

            <div className="form-section-title">Pagamento</div>
            <label>
              <span>Forma de pagamento</span>
              <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                {availablePaymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </label>
            {form.paymentMethod === "CASH" ? (
              <label>
                <span>Troco para quanto? (opcional)</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.cashChangeFor}
                  onChange={(event) => setForm({ ...form, cashChangeFor: event.target.value })}
                />
              </label>
            ) : null}
            {form.paymentMethod === "PIX_MANUAL" ? (
              <div className="helper-box">A loja confirmara o pagamento manualmente.</div>
            ) : null}
            {form.paymentMethod === "ONLINE" ? (
              <label>
                <span>CPF/CNPJ para Pix automatico</span>
                <input required value={form.payerDocument} onChange={(event) => setForm({ ...form, payerDocument: event.target.value })} />
              </label>
            ) : null}
            <label>
              <span>Observacao do pedido</span>
              <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>

            <div className="totals-card">
              <span>Subtotal <strong>{formatCurrency(subtotal)}</strong></span>
              <span>Taxa de entrega <strong>{deliveryFee === undefined ? "Selecione o bairro" : formatCurrency(deliveryFee)}</strong></span>
              <span>Total <strong>{formatCurrency(total)}</strong></span>
            </div>
            {missingMinimum > 0 ? (
              <div className="helper-box">Faltam {formatCurrency(missingMinimum)} para atingir o pedido minimo.</div>
            ) : null}

            <button className="primary-button" disabled={submitting || !canCheckout} type="submit">
              {submitting ? "Enviando..." : "Confirmar pedido"}
            </button>
          </form>
        </aside>
      </section>

      <StoreProfile storeData={storeData} />

      {selectedProduct ? (
        <ProductDetailModal
          notes={selectedNotes}
          onAdd={() => addToCart(selectedProduct, selectedQuantity, selectedNotes)}
          onClose={() => setSelectedProduct(null)}
          onNotesChange={setSelectedNotes}
          onQuantityChange={setSelectedQuantity}
          product={selectedProduct}
          quantity={selectedQuantity}
        />
      ) : null}
    </main>
  );
}

function StoreProfile({ storeData }: { storeData: PublicStoreResponse }) {
  return (
    <section className="profile-card" id="perfil">
      <div>
        <span className="brand-chip">Perfil da loja</span>
        <h2>{storeData.store.name}</h2>
        <p>{storeData.store.description ?? "Informacoes publicas da empresa."}</p>
      </div>
      <div className="profile-grid">
        <div>
          <strong>Status</strong>
          <span>{storeData.store.availability?.message ?? "Loja aberta para pedidos."}</span>
        </div>
        <div>
          <strong>Pedido minimo</strong>
          <span>
            {storeData.store.minimumOrder && storeData.store.minimumOrder > 0
              ? formatCurrency(storeData.store.minimumOrder)
              : "Sem pedido minimo"}
          </span>
        </div>
        <div>
          <strong>Pagamento</strong>
          <span>
            {(
              storeData.paymentOptions?.options ??
              storeData.paymentOptions?.methods.map((method) => ({
                value: method,
                label: paymentCheckoutLabel(method),
                orderPaymentMethod: method === "CARD_DEBIT_ON_DELIVERY" || method === "CARD_CREDIT_ON_DELIVERY"
                  ? "CARD_ON_DELIVERY"
                  : method
              })) ??
              []
            ).map((method) => method.label).join(", ")}
          </span>
        </div>
        <div>
          <strong>Endereco</strong>
          <span>{formatStoreAddress(storeData.store)}</span>
        </div>
        {storeData.store.phone ? (
          <div>
            <strong>Contato</strong>
            <span>{storeData.store.phone}</span>
          </div>
        ) : null}
      </div>
      {storeData.store.openingHours?.length ? (
        <div className="hours-grid">
          {storeData.store.openingHours.map((hour) => (
            <div key={hour.dayOfWeek}>
              <strong>{DAY_LABELS[hour.dayOfWeek]}</strong>
              <span>{hour.closed ? "Fechado" : `${hour.openTime} as ${hour.closeTime}`}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProductDetailModal({
  product,
  quantity,
  notes,
  onClose,
  onAdd,
  onQuantityChange,
  onNotesChange
}: {
  product: PublicProduct;
  quantity: number;
  notes: string;
  onClose: () => void;
  onAdd: () => void;
  onQuantityChange: (quantity: number) => void;
  onNotesChange: (notes: string) => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="product-modal">
        <button className="modal-close" onClick={onClose} type="button">Fechar</button>
        <div className="product-modal-image">
          {product.imageUrl ? (
            <img alt={product.name} src={toMediaUrl(product.imageUrl)} />
          ) : (
            <span>{product.name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="product-modal-copy">
          <span className="pill success">{product.category}</span>
          <h2>{product.name}</h2>
          <p>{product.description ?? "Produto do cardapio da loja."}</p>
          <strong>{formatCurrency(product.price)}</strong>
          <label>
            <span>Observacao do item</span>
            <textarea
              maxLength={240}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Ex.: sem cebola, molho separado"
              rows={3}
              value={notes}
            />
          </label>
          <div className="modal-actions">
            <div className="quantity-control">
              <button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>-</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => onQuantityChange(quantity + 1)}>+</button>
            </div>
            <button className="primary-button" onClick={onAdd} type="button">
              Adicionar {formatCurrency(product.price * quantity)}
            </button>
          </div>
        </div>
      </section>
    </div>
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
            <span>Pagamento <strong>{order.paymentMethodLabel ?? paymentMethodLabel(order.paymentMethod)}</strong></span>
            {order.cashChangeNeeded && order.cashChangeFor ? (
              <span>Troco para <strong>{formatCurrency(order.cashChangeFor)}</strong></span>
            ) : null}
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
              <div className="cart-item" key={`${item.name}-${item.quantity}-${item.notes ?? ""}`}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                  {item.notes ? <small>{item.notes}</small> : null}
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

function loadSavedCustomer(slug: string): CheckoutForm {
  try {
    const raw = window.localStorage.getItem(customerKey(slug));
    return raw ? { ...initialCheckoutForm, ...JSON.parse(raw) as Partial<CheckoutForm> } : initialCheckoutForm;
  } catch {
    return initialCheckoutForm;
  }
}

function saveCustomer(slug: string, form: CheckoutForm) {
  window.localStorage.setItem(
    customerKey(slug),
    JSON.stringify({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      addressZipCode: form.addressZipCode,
      addressStreet: form.addressStreet,
      addressNumber: form.addressNumber,
      addressDistrict: form.addressDistrict,
      addressComplement: form.addressComplement,
      addressCity: form.addressCity,
      addressState: form.addressState,
      addressReference: form.addressReference
    })
  );
}

function cartKey(slug: string) {
  return `mototake:storefront-cart:${slug}`;
}

function customerKey(slug: string) {
  return `mototake:storefront-customer:${slug}`;
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

function paymentMethodLabel(method: PublicOrder["paymentMethod"]) {
  const labels: Record<PublicOrder["paymentMethod"], string> = {
    CASH: "Dinheiro",
    CARD_ON_DELIVERY: "Cartao na entrega",
    PIX_MANUAL: "Pix manual",
    ONLINE: "Pix automatico"
  };

  return labels[method];
}

function paymentCheckoutLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Dinheiro",
    CARD_DEBIT_ON_DELIVERY: "Cartao de debito na entrega",
    CARD_CREDIT_ON_DELIVERY: "Cartao de credito na entrega",
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

function formatStoreAddress(store: PublicStoreResponse["store"]) {
  return [
    store.address,
    store.addressComplement,
    store.addressCity,
    store.addressState,
    store.addressZipCode
  ]
    .filter(Boolean)
    .join(", ");
}

function buildCheckoutBlockMessage(
  missingMinimum: number,
  fulfillmentType: FulfillmentType,
  selectedZone?: { district: string; fee: number }
) {
  if (missingMinimum > 0) {
    return `Faltam ${formatCurrency(missingMinimum)} para atingir o pedido minimo.`;
  }

  if (fulfillmentType === "DELIVERY" && !selectedZone) {
    return "Selecione um bairro atendido pela loja.";
  }

  return "Revise o carrinho antes de finalizar.";
}
