import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../features/auth/auth-context";
import { cashRegistersService } from "../features/cash-registers/cash-registers-service";
import { ApiError } from "../lib/http";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { PageHeader } from "../shared/ui/PageHeader";
import type { CashRegister, CashRegisterSession, CashMovementType } from "../types/api";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseMoney(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function movementLabel(type: CashMovementType) {
  const labels: Record<CashMovementType, string> = {
    OPENING: "Abertura",
    SALE: "Venda em dinheiro",
    CASH_IN: "Reforco",
    CASH_OUT: "Sangria",
    REFUND: "Estorno",
    ADJUSTMENT: "Ajuste",
    CLOSING_DIFFERENCE: "Diferenca de fechamento"
  };

  return labels[type];
}

export function CashRegistersPage() {
  const { token } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [selectedSession, setSelectedSession] = useState<CashRegisterSession | null>(null);
  const [newRegisterName, setNewRegisterName] = useState("Caixa principal");
  const [openingAmount, setOpeningAmount] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementType, setMovementType] = useState<"cash-in" | "cash-out">("cash-in");
  const [countedCashAmount, setCountedCashAmount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      void loadCashData();
    }
  }, [token]);

  const selectedRegister = useMemo(
    () => registers.find((register) => register.id === selectedRegisterId) ?? registers[0] ?? null,
    [registers, selectedRegisterId]
  );

  useEffect(() => {
    if (!selectedRegisterId && registers[0]) {
      setSelectedRegisterId(registers[0].id);
    }
  }, [registers, selectedRegisterId]);

  async function loadCashData() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loadedRegisters, loadedSessions] = await Promise.all([
        cashRegistersService.list(token),
        cashRegistersService.listSessions(token, { page: 1 })
      ]);
      setRegisters(loadedRegisters);
      setSessions(loadedSessions.items);

      const current = loadedRegisters.find((register) => register.currentSession)?.currentSession;
      if (current) {
        const fullSession = await cashRegistersService.getSession(token, current.id);
        setSelectedSession(fullSession);
        setCountedCashAmount(String(fullSession.summary.expectedCashAmount));
      } else {
        setSelectedSession(null);
      }
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Nao foi possivel carregar o caixa.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRegister() {
    if (!token || !newRegisterName.trim()) {
      return;
    }

    await runAction(async () => {
      await cashRegistersService.create(token, newRegisterName.trim());
      setSuccessMessage("Caixa criado com sucesso.");
      await loadCashData();
    });
  }

  async function handleOpenRegister() {
    if (!token || !selectedRegister) {
      return;
    }

    const amount = parseMoney(openingAmount);
    if (!Number.isFinite(amount)) {
      setError("Informe um saldo inicial valido.");
      return;
    }

    await runAction(async () => {
      const session = await cashRegistersService.open(
        token,
        selectedRegister.id,
        amount,
        openingNotes.trim() || undefined
      );
      setSelectedSession(session);
      setCountedCashAmount(String(session.summary.expectedCashAmount));
      setSuccessMessage("Caixa aberto com sucesso.");
      await loadCashData();
    });
  }

  async function handleMovement() {
    if (!token || !selectedSession) {
      return;
    }

    const amount = parseMoney(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0 || movementReason.trim().length < 3) {
      setError("Informe valor e motivo valido para a movimentacao.");
      return;
    }

    await runAction(async () => {
      const nextSession =
        movementType === "cash-in"
          ? await cashRegistersService.cashIn(token, selectedSession.id, {
              amount,
              reason: movementReason.trim()
            })
          : await cashRegistersService.cashOut(token, selectedSession.id, {
              amount,
              reason: movementReason.trim()
            });
      setSelectedSession(nextSession);
      setMovementAmount("");
      setMovementReason("");
      setSuccessMessage(movementType === "cash-in" ? "Reforco registrado." : "Sangria registrada.");
      await loadCashData();
    });
  }

  async function handleCloseRegister() {
    if (!token || !selectedSession) {
      return;
    }

    const amount = parseMoney(countedCashAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Informe um valor contado valido.");
      return;
    }

    await runAction(async () => {
      const closedSession = await cashRegistersService.close(
        token,
        selectedSession.id,
        amount,
        closingNotes.trim() || undefined
      );
      setSelectedSession(closedSession);
      setConfirmCloseOpen(false);
      setSuccessMessage("Caixa fechado com sucesso.");
      await loadCashData();
    });
  }

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Nao foi possivel concluir a operacao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Caixa"
        description="Abra, movimente e feche o caixa do PDV com conferencia simples por forma de pagamento."
      />

      {error ? <div className="feedback feedback-error">{error}</div> : null}
      {successMessage ? <div className="feedback feedback-success">{successMessage}</div> : null}

      {loading ? (
        <div className="screen-state state-loading">Carregando caixa...</div>
      ) : (
        <div className="cash-register-grid">
          <div className="panel form-grid">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Caixas</p>
                <h3>Controle operacional</h3>
              </div>
              <span className={selectedSession?.status === "OPEN" ? "pill dashboard-status-active" : "pill pill-muted"}>
                {selectedSession?.status === "OPEN" ? "Aberto" : "Fechado"}
              </span>
            </div>

            <label className="field">
              <span>Selecionar caixa</span>
              <select
                onChange={(event) => setSelectedRegisterId(event.target.value)}
                value={selectedRegister?.id ?? ""}
              >
                {registers.map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.name} {register.currentSession ? "(aberto)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-action-row">
              <label className="field">
                <span>Novo caixa</span>
                <input
                  maxLength={80}
                  onChange={(event) => setNewRegisterName(event.target.value)}
                  value={newRegisterName}
                />
              </label>
              <button className="secondary-button" disabled={saving} onClick={() => void handleCreateRegister()} type="button">
                Criar caixa
              </button>
            </div>

            {!selectedSession || selectedSession.status !== "OPEN" ? (
              <div className="form-grid">
                <label className="field">
                  <span>Saldo inicial</span>
                  <input
                    min="0"
                    onChange={(event) => setOpeningAmount(event.target.value)}
                    step="0.01"
                    type="number"
                    value={openingAmount}
                  />
                </label>
                <label className="field">
                  <span>Observacao de abertura</span>
                  <textarea
                    onChange={(event) => setOpeningNotes(event.target.value)}
                    rows={3}
                    value={openingNotes}
                  />
                </label>
                <button className="primary-button" disabled={!selectedRegister || saving} onClick={() => void handleOpenRegister()} type="button">
                  Abrir caixa
                </button>
              </div>
            ) : (
              <div className="feedback feedback-info">
                Caixa aberto por {selectedSession.openedBy?.name ?? "operador"} em{" "}
                {new Date(selectedSession.openedAt).toLocaleString("pt-BR")}.
              </div>
            )}
          </div>

          <div className="panel form-grid">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Resumo</p>
                <h3>Turno atual</h3>
              </div>
            </div>

            {selectedSession ? (
              <>
                <div className="order-summary cash-summary">
                  <div>Inicial<strong>{formatMoney(selectedSession.summary.openingAmount)}</strong></div>
                  <div>Dinheiro vendido<strong>{formatMoney(selectedSession.summary.cashSales)}</strong></div>
                  <div>Cartao<strong>{formatMoney(selectedSession.summary.cardSales)}</strong></div>
                  <div>Pix manual<strong>{formatMoney(selectedSession.summary.pixManualSales)}</strong></div>
                  <div>Reforcos<strong>{formatMoney(selectedSession.summary.cashInTotal)}</strong></div>
                  <div>Sangrias<strong>{formatMoney(selectedSession.summary.cashOutTotal)}</strong></div>
                  <div>Esperado em dinheiro<strong>{formatMoney(selectedSession.summary.expectedCashAmount)}</strong></div>
                  <div>Total vendido<strong>{formatMoney(selectedSession.summary.totalSold)}</strong></div>
                  <div>Diferenca<strong>{formatMoney(selectedSession.summary.differenceAmount ?? 0)}</strong></div>
                </div>

                {selectedSession.status === "OPEN" ? (
                  <div className="form-grid">
                    <div className="form-columns">
                      <label className="field">
                        <span>Tipo</span>
                        <select
                          onChange={(event) => setMovementType(event.target.value as "cash-in" | "cash-out")}
                          value={movementType}
                        >
                          <option value="cash-in">Reforco</option>
                          <option value="cash-out">Sangria</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Valor</span>
                        <input
                          min="0.01"
                          onChange={(event) => setMovementAmount(event.target.value)}
                          step="0.01"
                          type="number"
                          value={movementAmount}
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Motivo</span>
                      <input
                        maxLength={300}
                        onChange={(event) => setMovementReason(event.target.value)}
                        value={movementReason}
                      />
                    </label>
                    <button className="secondary-button" disabled={saving} onClick={() => void handleMovement()} type="button">
                      Registrar {movementType === "cash-in" ? "reforco" : "sangria"}
                    </button>

                    <div className="form-columns">
                      <label className="field">
                        <span>Valor contado</span>
                        <input
                          min="0"
                          onChange={(event) => setCountedCashAmount(event.target.value)}
                          step="0.01"
                          type="number"
                          value={countedCashAmount}
                        />
                      </label>
                      <label className="field">
                        <span>Observacao de fechamento</span>
                        <input
                          maxLength={500}
                          onChange={(event) => setClosingNotes(event.target.value)}
                          value={closingNotes}
                        />
                      </label>
                    </div>
                    <button className="danger-button" disabled={saving} onClick={() => setConfirmCloseOpen(true)} type="button">
                      Fechar caixa
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-state">Nenhum caixa aberto. Selecione ou crie um caixa para iniciar o turno.</div>
            )}
          </div>

          <div className="panel form-grid cash-history-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Movimentacoes</p>
                <h3>Historico do caixa</h3>
              </div>
            </div>

            {selectedSession?.movements.length ? (
              <div className="stack-list">
                {selectedSession.movements.map((movement) => (
                  <div className="inline-card cash-movement-card" key={movement.id}>
                    <div>
                      <strong>{movementLabel(movement.type)}</strong>
                      <p>
                        {new Date(movement.createdAt).toLocaleString("pt-BR")} · {movement.reason ?? "Sem motivo"}
                      </p>
                    </div>
                    <span>{movement.user?.name ?? "Operador"}</span>
                    <strong>{formatMoney(movement.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhuma movimentacao registrada neste caixa.</div>
            )}

            {sessions.length ? (
              <div className="stack-list">
                <p className="section-kicker">Ultimas sessoes</p>
                {sessions.slice(0, 5).map((session) => (
                  <button
                    className="pdv-product-card"
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    type="button"
                  >
                    <span>
                      <strong>{session.cashRegister.name}</strong>
                      <small>{new Date(session.openedAt).toLocaleString("pt-BR")}</small>
                    </span>
                    <strong>{session.status === "OPEN" ? "Aberto" : "Fechado"}</strong>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {confirmCloseOpen && selectedSession ? (
        <ConfirmDialog
          confirmLabel="Fechar caixa"
          description={`Saldo esperado: ${formatMoney(selectedSession.summary.expectedCashAmount)}. Confirme somente apos conferir o dinheiro fisico.`}
          isSubmitting={saving}
          onCancel={() => setConfirmCloseOpen(false)}
          onConfirm={() => void handleCloseRegister()}
          title="Fechar caixa?"
          tone="danger"
        />
      ) : null}
    </section>
  );
}
