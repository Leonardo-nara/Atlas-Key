import QRCode from "qrcode";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../features/auth/auth-context";
import { productsService } from "../features/products/products-service";
import {
  storefrontService,
  type StorefrontSettingsInput
} from "../features/storefront/storefront-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type {
  Product,
  StorefrontOpeningHour,
  StorefrontPaymentMethod,
  StorefrontSettings
} from "../types/api";

const DEFAULT_STORE_URL_BASE =
  import.meta.env.VITE_STOREFRONT_URL ??
    (import.meta.env.DEV
      ? "http://localhost:5174"
      : "https://pedido.mototake.com.br");

const DAYS = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado"
];

const PAYMENT_OPTIONS: Array<{ value: StorefrontPaymentMethod; label: string; helper: string }> = [
  {
    value: "CASH",
    label: "Dinheiro",
    helper: "Permite informar troco no checkout."
  },
  {
    value: "CARD_DEBIT_ON_DELIVERY",
    label: "Cartao de debito na entrega",
    helper: "Cliente paga na maquininha da loja ou do motoboy."
  },
  {
    value: "CARD_CREDIT_ON_DELIVERY",
    label: "Cartao de credito na entrega",
    helper: "Cliente paga na maquininha da loja ou do motoboy."
  },
  {
    value: "PIX_MANUAL",
    label: "Pix manual",
    helper: "Usa a chave configurada em Pix manual."
  }
];

interface StorefrontSettingsForm {
  slug: string;
  publicName: string;
  publicPhone: string;
  addressComplement: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  publicDescription: string;
  storefrontEnabled: boolean;
  pickupEnabled: boolean;
  businessHoursNote: string;
  storefrontMinimumOrder: number;
  storefrontPaymentMethods: StorefrontPaymentMethod[];
  storefrontOpeningHours: StorefrontOpeningHour[];
  averagePreparationMinutes: number;
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
}

const defaultOpeningHours: StorefrontOpeningHour[] = DAYS.map((_, dayOfWeek) => ({
  dayOfWeek,
  closed: false,
  openTime: "16:00",
  closeTime: "23:00"
}));

const emptyForm: StorefrontSettingsForm = {
  slug: "",
  publicName: "",
  publicPhone: "",
  addressComplement: "",
  addressCity: "",
  addressState: "",
  addressZipCode: "",
  publicDescription: "",
  storefrontEnabled: false,
  pickupEnabled: true,
  businessHoursNote: "",
  storefrontMinimumOrder: 0,
  storefrontPaymentMethods: ["CASH", "CARD_DEBIT_ON_DELIVERY", "CARD_CREDIT_ON_DELIVERY"],
  storefrontOpeningHours: defaultOpeningHours,
  averagePreparationMinutes: 25,
  deliveryTimeMinMinutes: 20,
  deliveryTimeMaxMinutes: 45
};

export function StorefrontSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const publicUrl = useMemo(() => {
    const slug = form.slug.trim() || settings?.slug?.trim();

    if (!slug) {
      return "";
    }

    return `${DEFAULT_STORE_URL_BASE.replace(/\/+$/, "")}/loja/${slug}`;
  }, [form.slug, settings?.slug]);

  const publishedProducts = products.filter(
    (product) => product.available && product.showInStorefront
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadSettings();
  }, [token]);

  useEffect(() => {
    if (!publicUrl) {
      setQrCode(null);
      return;
    }

    let cancelled = false;

    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: {
        dark: "#06111F",
        light: "#F4F9FF"
      }
    })
      .then((url) => {
        if (!cancelled) {
          setQrCode(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCode(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccessMessage(null), 3500);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  async function loadSettings() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextSettings, nextProducts] = await Promise.all([
        storefrontService.getSettings(token),
        productsService.list(token)
      ]);

      setSettings(nextSettings);
      setProducts(nextProducts);
      setForm({
        slug: nextSettings.slug ?? "",
        publicName: nextSettings.publicName ?? "",
        publicPhone: nextSettings.publicPhone ?? "",
        addressComplement: nextSettings.addressComplement ?? "",
        addressCity: nextSettings.addressCity ?? "",
        addressState: nextSettings.addressState ?? "",
        addressZipCode: nextSettings.addressZipCode ?? "",
        publicDescription: nextSettings.publicDescription ?? "",
        storefrontEnabled: nextSettings.storefrontEnabled,
        pickupEnabled: nextSettings.pickupEnabled,
        businessHoursNote: nextSettings.businessHoursNote ?? "",
        storefrontMinimumOrder: nextSettings.storefrontMinimumOrder ?? 0,
        storefrontPaymentMethods:
          nextSettings.storefrontPaymentMethods?.length
            ? nextSettings.storefrontPaymentMethods.filter((method) => method !== "ONLINE")
            : emptyForm.storefrontPaymentMethods,
        storefrontOpeningHours:
          nextSettings.storefrontOpeningHours?.length === 7
            ? nextSettings.storefrontOpeningHours
            : defaultOpeningHours,
        averagePreparationMinutes: nextSettings.averagePreparationMinutes,
        deliveryTimeMinMinutes: nextSettings.deliveryTimeMinMinutes,
        deliveryTimeMaxMinutes: nextSettings.deliveryTimeMaxMinutes
      });
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar a loja online."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!form.slug.trim()) {
      setError("Informe o endereco da loja para ativar a Loja Online.");
      return;
    }

    if (form.storefrontPaymentMethods.length === 0) {
      setError("Selecione pelo menos uma forma de pagamento.");
      return;
    }

    const payload: StorefrontSettingsInput = {
      slug: form.slug.trim(),
      publicName: form.publicName.trim() || null,
      publicPhone: form.publicPhone.trim() || null,
      addressComplement: form.addressComplement.trim() || null,
      addressCity: form.addressCity.trim() || null,
      addressState: form.addressState.trim() || null,
      addressZipCode: form.addressZipCode.trim() || null,
      publicDescription: form.publicDescription.trim() || null,
      storefrontEnabled: form.storefrontEnabled,
      pickupEnabled: form.pickupEnabled,
      businessHoursNote: form.businessHoursNote.trim() || null,
      storefrontMinimumOrder: Number(form.storefrontMinimumOrder),
      storefrontPaymentMethods: form.storefrontPaymentMethods,
      storefrontOpeningHours: form.storefrontOpeningHours,
      averagePreparationMinutes: Number(form.averagePreparationMinutes),
      deliveryTimeMinMinutes: Number(form.deliveryTimeMinMinutes),
      deliveryTimeMaxMinutes: Number(form.deliveryTimeMaxMinutes)
    };

    setSaving(true);
    setError(null);

    try {
      const nextSettings = await storefrontService.updateSettings(token, payload);
      setSettings(nextSettings);
      setSuccessMessage("Loja online atualizada com sucesso.");
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Nao foi possivel salvar a loja online."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicUrl() {
    if (!publicUrl) {
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
    setSuccessMessage("Link copiado para a area de transferencia.");
  }

  function shareOnWhatsApp() {
    if (!publicUrl) {
      return;
    }

    const text = encodeURIComponent(
      `Faca seu pedido pelo nosso cardapio online:\n${publicUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function togglePaymentMethod(method: StorefrontPaymentMethod) {
    setForm((current) => ({
      ...current,
      storefrontPaymentMethods: current.storefrontPaymentMethods.includes(method)
        ? current.storefrontPaymentMethods.filter((item) => item !== method)
        : [...current.storefrontPaymentMethods, method]
    }));
  }

  function updateOpeningHour(
    dayOfWeek: number,
    patch: Partial<StorefrontOpeningHour>
  ) {
    setForm((current) => ({
      ...current,
      storefrontOpeningHours: current.storefrontOpeningHours.map((hour) =>
        hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour
      )
    }));
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Loja online"
        description="Configure o cardapio publico da empresa para receber pedidos pelo navegador, sem conta para o cliente."
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="screen-state">Carregando loja online...</div>
      ) : (
        <div className="storefront-settings-grid">
          <form className="panel form-grid" onSubmit={(event) => void handleSubmit(event)}>
            <section className="storefront-section">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Visao geral</p>
                  <h3>Sua loja online</h3>
                </div>
                <span className={form.storefrontEnabled ? "pill" : "pill pill-muted"}>
                  {form.storefrontEnabled ? "ATIVA" : "DESATIVADA"}
                </span>
              </div>

              <label className="checkbox-field">
                <input
                  checked={form.storefrontEnabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      storefrontEnabled: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                <span>Permitir pedidos pela Loja Online</span>
              </label>

              <label className="field">
                <span>Endereco da loja</span>
                <input
                  maxLength={64}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: event.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")
                    }))
                  }
                  placeholder="ex.: ilha-lanches"
                  value={form.slug}
                />
              </label>

              {publicUrl ? (
                <div className="storefront-link-box">{publicUrl}</div>
              ) : null}

              <div className="row-actions">
                <button className="secondary-button" onClick={() => void copyPublicUrl()} type="button">
                  Copiar link
                </button>
                <button className="secondary-button" onClick={shareOnWhatsApp} type="button">
                  Compartilhar no WhatsApp
                </button>
                {publicUrl ? (
                  <a className="ghost-button" href={publicUrl} rel="noreferrer" target="_blank">
                    Visualizar como cliente
                  </a>
                ) : null}
              </div>
            </section>

            <section className="storefront-section">
              <p className="section-kicker">Perfil da loja</p>
              <div className="form-two-columns">
                <label className="field">
                  <span>Nome publico</span>
                  <input
                    maxLength={160}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, publicName: event.target.value }))
                    }
                    placeholder={settings?.storeName ?? "Nome da loja"}
                    value={form.publicName}
                  />
                </label>
                <label className="field">
                  <span>WhatsApp / telefone</span>
                  <input
                    maxLength={20}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, publicPhone: event.target.value }))
                    }
                    placeholder="(14) 99999-0000"
                    value={form.publicPhone}
                  />
                </label>
              </div>

              <label className="field">
                <span>Descricao publica</span>
                <textarea
                  maxLength={500}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicDescription: event.target.value
                    }))
                  }
                  placeholder="Texto curto para apresentar a loja ao cliente."
                  rows={4}
                  value={form.publicDescription}
                />
              </label>

              <div className="form-two-columns">
                <label className="field">
                  <span>Complemento</span>
                  <input
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressComplement: event.target.value
                      }))
                    }
                    value={form.addressComplement}
                  />
                </label>
                <label className="field">
                  <span>CEP</span>
                  <input
                    maxLength={12}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, addressZipCode: event.target.value }))
                    }
                    value={form.addressZipCode}
                  />
                </label>
                <label className="field">
                  <span>Cidade</span>
                  <input
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, addressCity: event.target.value }))
                    }
                    value={form.addressCity}
                  />
                </label>
                <label className="field">
                  <span>Estado</span>
                  <input
                    maxLength={2}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressState: event.target.value.toUpperCase()
                      }))
                    }
                    value={form.addressState}
                  />
                </label>
              </div>
            </section>

            <section className="storefront-section">
              <p className="section-kicker">Horarios</p>
              <div className="storefront-hours-list">
                {form.storefrontOpeningHours.map((hour) => (
                  <div className="storefront-hour-row" key={hour.dayOfWeek}>
                    <strong>{DAYS[hour.dayOfWeek]}</strong>
                    <label className="checkbox-field compact-checkbox">
                      <input
                        checked={hour.closed}
                        onChange={(event) =>
                          updateOpeningHour(hour.dayOfWeek, { closed: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span>Fechado</span>
                    </label>
                    <input
                      disabled={hour.closed}
                      onChange={(event) =>
                        updateOpeningHour(hour.dayOfWeek, { openTime: event.target.value })
                      }
                      type="time"
                      value={hour.openTime ?? "16:00"}
                    />
                    <input
                      disabled={hour.closed}
                      onChange={(event) =>
                        updateOpeningHour(hour.dayOfWeek, { closeTime: event.target.value })
                      }
                      type="time"
                      value={hour.closeTime ?? "23:00"}
                    />
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Observacao de horario</span>
                <input
                  maxLength={160}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      businessHoursNote: event.target.value
                    }))
                  }
                  placeholder="Ex.: Atendimento sujeito a disponibilidade da loja"
                  value={form.businessHoursNote}
                />
              </label>
            </section>

            <section className="storefront-section">
              <p className="section-kicker">Pagamentos</p>
              <div className="storefront-payment-list">
                {PAYMENT_OPTIONS.map((option) => (
                  <label className="checkbox-field storefront-payment-option" key={option.value}>
                    <input
                      checked={form.storefrontPaymentMethods.includes(option.value)}
                      onChange={() => togglePaymentMethod(option.value)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.helper}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="feedback feedback-warning">
                Cartao na entrega usa a maquininha da propria empresa ou do motoboy. Nenhum dado de cartao e armazenado.
              </div>
            </section>

            <section className="storefront-section">
              <p className="section-kicker">Entrega</p>
              <div className="form-two-columns">
                <label className="field">
                  <span>Pedido minimo</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        storefrontMinimumOrder: Number(event.target.value)
                      }))
                    }
                    step="0.01"
                    type="number"
                    value={form.storefrontMinimumOrder}
                  />
                </label>
                <label className="field">
                  <span>Retirada na loja</span>
                  <select
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        pickupEnabled: event.target.value === "true"
                      }))
                    }
                    value={String(form.pickupEnabled)}
                  >
                    <option value="true">Permitida</option>
                    <option value="false">Bloqueada</option>
                  </select>
                </label>
                <label className="field">
                  <span>Preparo medio (min)</span>
                  <input
                    min="5"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        averagePreparationMinutes: Number(event.target.value)
                      }))
                    }
                    type="number"
                    value={form.averagePreparationMinutes}
                  />
                </label>
                <label className="field">
                  <span>Entrega estimada (min-min)</span>
                  <div className="inline-fields">
                    <input
                      min="0"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          deliveryTimeMinMinutes: Number(event.target.value)
                        }))
                      }
                      type="number"
                      value={form.deliveryTimeMinMinutes}
                    />
                    <input
                      min="0"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          deliveryTimeMaxMinutes: Number(event.target.value)
                        }))
                      }
                      type="number"
                      value={form.deliveryTimeMaxMinutes}
                    />
                  </div>
                </label>
              </div>
            </section>

            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Salvando..." : "Salvar Loja Online"}
            </button>
          </form>

          <aside className="panel storefront-preview-card">
            <div>
              <p className="section-kicker">Produtos publicados</p>
              <h3>{publishedProducts.length} itens no cardapio</h3>
              <p className="muted-text">
                Produtos ativos com a opcao "Exibir na Loja Online" aparecem no cardapio publico.
              </p>
            </div>

            {publicUrl ? (
              <>
                {qrCode ? (
                  <img className="storefront-qr" alt="QR Code da loja online" src={qrCode} />
                ) : (
                  <div className="screen-state">Gerando QR Code...</div>
                )}
                <div className="storefront-link-box">{publicUrl}</div>
              </>
            ) : (
              <div className="empty-state">
                Salve um endereco da loja para gerar o link publico.
              </div>
            )}

            <div className="storefront-products-mini-list">
              {publishedProducts.slice(0, 8).map((product) => (
                <div key={product.id}>
                  <strong>{product.name}</strong>
                  <span>{product.category}</span>
                </div>
              ))}
              {publishedProducts.length === 0 ? (
                <div className="empty-state">
                  Nenhum produto publicado ainda. Abra Produtos e marque "Exibir na Loja Online".
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
