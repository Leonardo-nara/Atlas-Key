import { describe, it } from "node:test";
import assert from "node:assert/strict";

const helpers = require("../../scripts/full-pilot-qa-helpers.js") as {
  PREFIX: string;
  assertSandboxApi(apiUrl: string): void;
  assertNoSecrets(output: unknown): void;
};

describe("full pilot QA helpers", () => {
  it("mantem prefixo forte para dados descartaveis", () => {
    assert.equal(helpers.PREFIX, "QA_FULL_PILOT_");
  });

  it("recusa API de producao e aceita somente sandbox esperado", () => {
    assert.doesNotThrow(() => helpers.assertSandboxApi("https://rotapronta-api-sandbox-production.up.railway.app/api"));
    assert.throws(() => helpers.assertSandboxApi("https://rotapronta-api-production.up.railway.app/api"), /sandbox|producao/i);
  });

  it("bloqueia vazamento de segredo conhecido na saida", () => {
    const previous = process.env.ASAAS_WEBHOOK_TOKEN;
    process.env.ASAAS_WEBHOOK_TOKEN = "qa-secret-token";
    assert.throws(() => helpers.assertNoSecrets({ value: "qa-secret-token" }), /ASAAS_WEBHOOK_TOKEN/);
    if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
    else process.env.ASAAS_WEBHOOK_TOKEN = previous;
  });
});
