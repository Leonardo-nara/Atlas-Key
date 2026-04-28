import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../features/auth/auth-context";
import {
  deliveryZonesService,
  type DeliveryZoneInput
} from "../features/delivery-zones/delivery-zones-service";
import { ApiError } from "../lib/http";
import { PageHeader } from "../shared/ui/PageHeader";
import type { StoreDeliveryZone } from "../types/api";

const emptyForm: DeliveryZoneInput = {
  name: "",
  district: "",
  fee: 0,
  isActive: true
};

export function DeliveryZonesPage() {
  const { token } = useAuth();
  const [zones, setZones] = useState<StoreDeliveryZone[]>([]);
  const [form, setForm] = useState<DeliveryZoneInput>(emptyForm);
  const [editingZone, setEditingZone] = useState<StoreDeliveryZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadZones();
  }, [token]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccessMessage(null), 3500);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  async function loadZones() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setZones(await deliveryZonesService.list(token));
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Nao foi possivel carregar as taxas de entrega."
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

    const payload = {
      ...form,
      name: form.name.trim(),
      district: form.district.trim(),
      fee: Number(form.fee)
    };

    if (!payload.name || !payload.district || !Number.isFinite(payload.fee)) {
      setFormError("Informe nome, bairro e taxa validos.");
      return;
    }

    if (payload.fee < 0) {
      setFormError("A taxa nao pode ser negativa.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingZone) {
        await deliveryZonesService.update(token, editingZone.id, payload);
        setSuccessMessage("Regiao atualizada com sucesso.");
      } else {
        await deliveryZonesService.create(token, payload);
        setSuccessMessage("Regiao criada com sucesso.");
      }

      setEditingZone(null);
      setForm(emptyForm);
      await loadZones();
    } catch (submitError) {
      setFormError(
        submitError instanceof ApiError
          ? submitError.message
          : "Nao foi possivel salvar a regiao."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleZone(zone: StoreDeliveryZone) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      if (zone.isActive) {
        await deliveryZonesService.deactivate(token, zone.id);
        setSuccessMessage("Regiao desativada.");
      } else {
        await deliveryZonesService.update(token, zone.id, { isActive: true });
        setSuccessMessage("Regiao ativada.");
      }

      await loadZones();
    } catch (toggleError) {
      setError(
        toggleError instanceof ApiError
          ? toggleError.message
          : "Nao foi possivel alterar o status da regiao."
      );
    }
  }

  function startEdit(zone: StoreDeliveryZone) {
    setEditingZone(zone);
    setForm({
      name: zone.name,
      district: zone.district,
      fee: zone.fee,
      isActive: zone.isActive
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditingZone(null);
    setForm(emptyForm);
    setFormError(null);
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Taxas por bairro"
        description="Cadastre bairros atendidos e deixe a confirmacao do pedido mais rapida e consistente."
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="feedback feedback-success">{successMessage}</div>
      ) : null}

      <div className="zones-grid">
        <form className="panel form-grid" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <p className="section-kicker">Regiao de entrega</p>
            <h3>{editingZone ? "Editar taxa" : "Nova taxa"}</h3>
          </div>

          <label className="field">
            <span>Nome interno</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex.: Centro proximo"
              value={form.name}
            />
          </label>

          <label className="field">
            <span>Bairro usado na busca</span>
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, district: event.target.value }))
              }
              placeholder="Ex.: Centro"
              value={form.district}
            />
          </label>

          <label className="field">
            <span>Taxa padrao</span>
            <input
              min="0"
              onChange={(event) =>
                setForm((current) => ({ ...current, fee: Number(event.target.value) }))
              }
              step="0.01"
              type="number"
              value={form.fee}
            />
          </label>

          <label className="checkbox-field">
            <input
              checked={Boolean(form.isActive)}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              type="checkbox"
            />
            <span>Regiao ativa</span>
          </label>

          {formError ? <div className="feedback feedback-error">{formError}</div> : null}

          <div className="row-actions">
            {editingZone ? (
              <button className="secondary-button" onClick={cancelEdit} type="button">
                Cancelar
              </button>
            ) : null}
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Salvando..." : editingZone ? "Salvar alteracoes" : "Criar taxa"}
            </button>
          </div>
        </form>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Bairros cadastrados</p>
              <h3>Taxas ativas e inativas</h3>
            </div>
          </div>

          {loading ? (
            <div className="screen-state">Carregando taxas...</div>
          ) : zones.length === 0 ? (
            <div className="empty-state">
              Nenhuma taxa cadastrada. Crie uma regiao para sugerir taxa automaticamente.
            </div>
          ) : (
            <div className="stack-list">
              {zones.map((zone) => (
                <article className="delivery-zone-card" key={zone.id}>
                  <div>
                    <strong>{zone.name}</strong>
                    <p>{zone.district}</p>
                  </div>
                  <div>
                    <span className={zone.isActive ? "pill" : "pill pill-muted"}>
                      {zone.isActive ? "Ativa" : "Inativa"}
                    </span>
                    <strong>R$ {zone.fee.toFixed(2)}</strong>
                  </div>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => startEdit(zone)} type="button">
                      Editar
                    </button>
                    <button
                      className={zone.isActive ? "danger-button" : "secondary-button"}
                      onClick={() => void toggleZone(zone)}
                      type="button"
                    >
                      {zone.isActive ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
