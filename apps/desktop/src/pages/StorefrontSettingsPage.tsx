import QRCode from "qrcode";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../features/auth/auth-context";
import {
  storefrontService,
  type StorefrontSettingsInput
} from "../features/storefront/storefront-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { StorefrontSettings } from "../types/api";

const DEFAULT_STORE_URL_BASE =
  import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:5174";

interface StorefrontSettingsForm {
  slug: string;
  publicDescription: string;
  storefrontEnabled: boolean;
  pickupEnabled: boolean;
  businessHoursNote: string;
  averagePreparationMinutes: number;
  deliveryTimeMinMinutes: number;
  deliveryTimeMaxMinutes: number;
}

const emptyForm: StorefrontSettingsForm = {
  slug: "",
  publicDescription: "",
  storefrontEnabled: false,
  pickupEnabled: true,
  businessHoursNote: "",
  averagePreparationMinutes: 25,
  deliveryTimeMinMinutes: 20,
  deliveryTimeMaxMinutes: 45
};

export function StorefrontSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const publicUrl = useMemo(() => {
    const slug = settings?.slug?.trim() || form.slug.trim();

    if (!slug) {
      return "";
    }

    return `${DEFAULT_STORE_URL_BASE.replace(/\/+$/, "")}/loja/${slug}`;
  }, [form.slug, settings?.slug]);

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
      const nextSettings = await storefrontService.getSettings(token);
      setSettings(nextSettings);
      setForm({
        slug: nextSettings.slug ?? "",
        publicDescription: nextSettings.publicDescription ?? "",
        storefrontEnabled: nextSettings.storefrontEnabled,
        pickupEnabled: nextSettings.pickupEnabled,
        businessHoursNote: nextSettings.businessHoursNote ?? "",
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

    const payload: StorefrontSettingsInput = {
      slug: form.slug.trim(),
      publicDescription: form.publicDescription.trim() || null,
      storefrontEnabled: form.storefrontEnabled,
      pickupEnabled: form.pickupEnabled,
      businessHoursNote: form.businessHoursNote.trim() || null,
      averagePreparationMinutes: Number(form.averagePreparationMinutes),
      deliveryTimeMinMinutes: Number(form.deliveryTimeMinMinutes),
      deliveryTimeMaxMinutes: Number(form.deliveryTimeMaxMinutes)
    };

    if (!payload.slug) {
      setError("Informe um link curto para ativar a loja online.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
      setError("Use apenas letras minusculas, numeros e hifens no link.");
      return;
    }

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

  return (
    <section className="page-section">
      <PageHeader
        title="Loja online"
        description="Configure o link publico da loja para receber pedidos pelo navegador, sem exigir aplicativo do cliente."
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
            <div>
              <p className="section-kicker">Canal publico</p>
              <h3>Dados do link</h3>
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
              <span>Ativar loja online para clientes</span>
            </label>

            <label className="field">
              <span>Link curto da loja</span>
              <input
                maxLength={64}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: event.target.value.toLowerCase().replace(/\s+/g, "-")
                  }))
                }
                placeholder="ex.: mercado-central"
                value={form.slug}
              />
            </label>

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

            <label className="field">
              <span>Horario / observacao operacional</span>
              <input
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessHoursNote: event.target.value
                  }))
                }
                placeholder="Ex.: Atendimento de segunda a sabado, 8h as 18h"
                value={form.businessHoursNote}
              />
            </label>

            <div className="form-two-columns">
              <label className="field">
                <span>Preparo medio (min)</span>
                <input
                  min="1"
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
            </div>

            <div className="form-two-columns">
              <label className="field">
                <span>Entrega minima (min)</span>
                <input
                  min="1"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deliveryTimeMinMinutes: Number(event.target.value)
                    }))
                  }
                  type="number"
                  value={form.deliveryTimeMinMinutes}
                />
              </label>

              <label className="field">
                <span>Entrega maxima (min)</span>
                <input
                  min="1"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      deliveryTimeMaxMinutes: Number(event.target.value)
                    }))
                  }
                  type="number"
                  value={form.deliveryTimeMaxMinutes}
                />
              </label>
            </div>

            <div className="feedback feedback-warning">
              O cliente acessa pelo navegador. A loja continua confirmando pedido,
              taxa e pagamento conforme as regras atuais.
            </div>

            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Salvando..." : "Salvar loja online"}
            </button>
          </form>

          <aside className="panel storefront-preview-card">
            <div>
              <p className="section-kicker">Divulgacao</p>
              <h3>Link e QR Code</h3>
            </div>

            <span className={form.storefrontEnabled ? "pill" : "pill pill-muted"}>
              {form.storefrontEnabled ? "Loja online ativa" : "Loja online inativa"}
            </span>

            {publicUrl ? (
              <>
                <div className="storefront-link-box">{publicUrl}</div>
                {qrCode ? (
                  <img className="storefront-qr" alt="QR Code da loja online" src={qrCode} />
                ) : (
                  <div className="screen-state">Gerando QR Code...</div>
                )}
                <div className="row-actions">
                  <button className="secondary-button" onClick={() => void copyPublicUrl()} type="button">
                    Copiar link
                  </button>
                  <a className="ghost-button" href={publicUrl} rel="noreferrer" target="_blank">
                    Abrir loja
                  </a>
                </div>
              </>
            ) : (
              <div className="empty-state">
                Salve um link curto para gerar o endereco publico e o QR Code.
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
