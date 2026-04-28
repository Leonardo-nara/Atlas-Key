import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../features/auth/auth-context";
import {
  pixSettingsService,
  type PixSettingsInput
} from "../features/pix-settings/pix-settings-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { StorePixKeyType } from "../types/api";

const pixKeyTypeOptions: Array<{ value: StorePixKeyType; label: string }> = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "RANDOM_KEY", label: "Chave aleatória" }
];

const emptyForm: PixSettingsInput = {
  pixEnabled: false,
  pixKeyType: "EMAIL",
  pixKey: "",
  pixRecipientName: "",
  pixInstructions: ""
};

export function PixSettingsPage() {
  const { token } = useAuth();
  const [form, setForm] = useState<PixSettingsInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadSettings();
  }, [token]);

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
      const settings = await pixSettingsService.get(token);
      setForm({
        pixEnabled: settings.pixEnabled,
        pixKeyType: settings.pixKeyType ?? "EMAIL",
        pixKey: settings.pixKey ?? "",
        pixRecipientName: settings.pixRecipientName ?? "",
        pixInstructions: settings.pixInstructions ?? ""
      });
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar as configuracoes de Pix."
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

    const payload: PixSettingsInput = {
      pixEnabled: form.pixEnabled,
      pixKeyType: form.pixKeyType,
      pixKey: form.pixKey?.trim() || null,
      pixRecipientName: form.pixRecipientName?.trim() || null,
      pixInstructions: form.pixInstructions?.trim() || null
    };

    if (payload.pixEnabled && (!payload.pixKeyType || !payload.pixKey || !payload.pixRecipientName)) {
      setError("Para ativar Pix manual, informe tipo de chave, chave Pix e nome do recebedor.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const settings = await pixSettingsService.update(token, payload);
      setForm({
        pixEnabled: settings.pixEnabled,
        pixKeyType: settings.pixKeyType ?? "EMAIL",
        pixKey: settings.pixKey ?? "",
        pixRecipientName: settings.pixRecipientName ?? "",
        pixInstructions: settings.pixInstructions ?? ""
      });
      setSuccessMessage("Configurações de Pix manual salvas com sucesso.");
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Nao foi possivel salvar as configuracoes de Pix."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Pix manual"
        description="Configure a chave Pix que sera exibida ao cliente em pedidos com Pix manual. Nenhum QR Code ou cobranca automatica sera gerado."
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      {loading ? (
        <div className="screen-state">Carregando configuracoes...</div>
      ) : (
        <div className="zones-grid">
          <form className="panel form-grid" onSubmit={(event) => void handleSubmit(event)}>
            <div>
              <p className="section-kicker">Pagamento operacional</p>
              <h3>Configurar Pix manual</h3>
            </div>

            <label className="checkbox-field">
              <input
                checked={form.pixEnabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pixEnabled: event.target.checked
                  }))
                }
                type="checkbox"
              />
              <span>Ativar Pix manual para clientes</span>
            </label>

            <label className="field">
              <span>Tipo de chave Pix</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pixKeyType: event.target.value as StorePixKeyType
                  }))
                }
                value={form.pixKeyType ?? "EMAIL"}
              >
                {pixKeyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Chave Pix</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, pixKey: event.target.value }))
                }
                placeholder="Ex.: financeiro@loja.com"
                value={form.pixKey ?? ""}
              />
            </label>

            <label className="field">
              <span>Nome do recebedor</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pixRecipientName: event.target.value
                  }))
                }
                placeholder="Nome que o cliente deve conferir"
                value={form.pixRecipientName ?? ""}
              />
            </label>

            <label className="field">
              <span>Instruções para pagamento</span>
              <textarea
                maxLength={500}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pixInstructions: event.target.value
                  }))
                }
                placeholder="Ex.: envie o comprovante pelo WhatsApp da loja."
                rows={4}
                value={form.pixInstructions ?? ""}
              />
            </label>

            <div className="feedback feedback-warning">
              Esta configuração apenas mostra instruções ao cliente. O pagamento continua
              pendente até a loja marcar manualmente como pago.
            </div>

            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Salvando..." : "Salvar Pix manual"}
            </button>
          </form>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Resumo</p>
                <h3>Status do Pix manual</h3>
              </div>
            </div>

            <div className="order-detail-card">
              <span className={form.pixEnabled ? "pill" : "pill pill-muted"}>
                {form.pixEnabled ? "Ativo" : "Inativo"}
              </span>
              <p className="muted-text">
                Chave: {form.pixKey?.trim() ? form.pixKey : "nao informada"}
              </p>
              <p className="muted-text">
                Recebedor:{" "}
                {form.pixRecipientName?.trim()
                  ? form.pixRecipientName
                  : "nao informado"}
              </p>
              <p className="muted-text">
                Instruções:{" "}
                {form.pixInstructions?.trim()
                  ? form.pixInstructions
                  : "o texto padrao sera exibido ao cliente."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
