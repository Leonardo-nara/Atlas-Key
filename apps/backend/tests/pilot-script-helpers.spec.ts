import { describe, it } from "node:test";
import assert from "node:assert/strict";

const helpers = require("../../scripts/pilot-script-helpers.js") as {
  parsePaymentMethods(value?: string): string[];
  validateEmail(email: string): boolean;
  normalizeApiUrl(value: string): string;
  ensureProductionCreateGuard(input: { apply: boolean }): void;
  ensureProductionDeactivateGuard(input: { apply: boolean }): void;
  assertNoSensitiveKeys(object: unknown): void;
};

describe("pilot script helpers", () => {
  it("normaliza metodos de pagamento permitidos sem liberar gateway automatico", () => {
    assert.deepEqual(helpers.parsePaymentMethods("cash, pix_manual, CARD_ON_DELIVERY"), [
      "CASH",
      "PIX_MANUAL",
      "CARD_ON_DELIVERY"
    ]);
    assert.throws(() => helpers.parsePaymentMethods("ONLINE"), /nao permitidos/);
  });

  it("valida email e bloqueia API sandbox no validador da empresa real", () => {
    assert.equal(helpers.validateEmail("loja@example.com"), true);
    assert.equal(helpers.validateEmail("loja"), false);
    assert.equal(helpers.normalizeApiUrl("https://rotapronta-api-production.up.railway.app"), "https://rotapronta-api-production.up.railway.app/api");
    assert.throws(() => helpers.normalizeApiUrl("https://rotapronta-api-sandbox-production.up.railway.app/api"), /sandbox/);
  });

  it("exige confirmacoes explicitas para escrita real", () => {
    const previousPilotEnv = process.env.PILOT_ENV;
    const previousCreateConfirm = process.env.PILOT_STORE_CONFIRM;
    const previousDeactivateConfirm = process.env.PILOT_DEACTIVATE_CONFIRM;

    delete process.env.PILOT_ENV;
    delete process.env.PILOT_STORE_CONFIRM;
    delete process.env.PILOT_DEACTIVATE_CONFIRM;

    assert.doesNotThrow(() => helpers.ensureProductionCreateGuard({ apply: false }));
    assert.doesNotThrow(() => helpers.ensureProductionDeactivateGuard({ apply: false }));
    assert.throws(() => helpers.ensureProductionCreateGuard({ apply: true }), /PILOT_ENV=production/);
    assert.throws(() => helpers.ensureProductionDeactivateGuard({ apply: true }), /PILOT_ENV=production/);

    process.env.PILOT_ENV = "production";
    assert.throws(() => helpers.ensureProductionCreateGuard({ apply: true }), /CREATE_REAL_PILOT_STORE/);
    assert.throws(() => helpers.ensureProductionDeactivateGuard({ apply: true }), /DEACTIVATE_PILOT_STORE/);

    process.env.PILOT_STORE_CONFIRM = "CREATE_REAL_PILOT_STORE";
    process.env.PILOT_DEACTIVATE_CONFIRM = "DEACTIVATE_PILOT_STORE";
    assert.doesNotThrow(() => helpers.ensureProductionCreateGuard({ apply: true }));
    assert.doesNotThrow(() => helpers.ensureProductionDeactivateGuard({ apply: true }));

    if (previousPilotEnv === undefined) delete process.env.PILOT_ENV;
    else process.env.PILOT_ENV = previousPilotEnv;
    if (previousCreateConfirm === undefined) delete process.env.PILOT_STORE_CONFIRM;
    else process.env.PILOT_STORE_CONFIRM = previousCreateConfirm;
    if (previousDeactivateConfirm === undefined) delete process.env.PILOT_DEACTIVATE_CONFIRM;
    else process.env.PILOT_DEACTIVATE_CONFIRM = previousDeactivateConfirm;
  });

  it("bloqueia vazamento de valores sensiveis conhecidos", () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "super-secret-test-value";
    assert.throws(() => helpers.assertNoSensitiveKeys({ token: "super-secret-test-value" }), /JWT_SECRET/);
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
});
