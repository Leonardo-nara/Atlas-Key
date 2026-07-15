const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const PREFIX = "QA_FULL_PILOT_";
const API_SANDBOX_HOST = "rotapronta-api-sandbox-production.up.railway.app";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} nao configurado`);
  return value;
}

function isSandboxDatabase() {
  const url = process.env.DATABASE_URL || "";
  return url.includes("postgres.railway.internal") || url.includes("railway.internal");
}

function assertSandboxRuntime() {
  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || "";
  if (publicDomain && !publicDomain.includes("sandbox")) {
    throw new Error("Servico Railway atual nao parece sandbox");
  }
  if (!isSandboxDatabase()) {
    throw new Error("DATABASE_URL nao parece ser o Postgres interno do sandbox");
  }
}

function assertSandboxApi(apiUrl) {
  if (!apiUrl || !apiUrl.includes(API_SANDBOX_HOST)) {
    throw new Error("API sandbox obrigatoria para QA operacional");
  }
  if (apiUrl.includes("rotapronta-api-production.up.railway.app")) {
    throw new Error("API de producao recusada");
  }
}

function assertSeedGuard() {
  if (process.env.FULL_PILOT_QA_ENV !== "sandbox") {
    throw new Error("Seed exige FULL_PILOT_QA_ENV=sandbox");
  }
  if (process.env.FULL_PILOT_QA_CONFIRM !== "CREATE_FULL_PILOT_QA") {
    throw new Error("Seed exige FULL_PILOT_QA_CONFIRM=CREATE_FULL_PILOT_QA");
  }
  assertSandboxRuntime();
}

function assertCleanupGuard() {
  if (process.env.FULL_PILOT_QA_ENV !== "sandbox") {
    throw new Error("Cleanup exige FULL_PILOT_QA_ENV=sandbox");
  }
  if (process.argv.includes("--apply") && process.env.FULL_PILOT_QA_CLEANUP_CONFIRM !== "DELETE_FULL_PILOT_QA") {
    throw new Error("Cleanup real exige FULL_PILOT_QA_CLEANUP_CONFIRM=DELETE_FULL_PILOT_QA");
  }
  assertSandboxRuntime();
}

function password() {
  return `${crypto.randomBytes(14).toString("base64url")}aA1!`;
}

async function hashPassword(value) {
  return bcrypt.hash(value, 10);
}

function qaEmail(kind) {
  return `${PREFIX.toLowerCase()}${kind}@example.test`;
}

function writeCredentials(payload) {
  const root = path.resolve(__dirname, "../../..", ".demo-local");
  fs.mkdirSync(root, { recursive: true });
  const filePath = path.join(root, "full-pilot-qa-credentials.json");
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

function redact(value) {
  if (!value) return value;
  return `${String(value).slice(0, 4)}...redacted`;
}

async function login(apiUrl, email, passwordValue) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: passwordValue })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.accessToken) {
    throw new Error(`Login falhou para ${email}: HTTP ${response.status}`);
  }
  return body.accessToken;
}

async function api(apiUrl, token, method, route, body) {
  const response = await fetch(`${apiUrl}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, ok: response.ok, body: payload };
}

function expectStatus(label, result, expected) {
  if (result.status !== expected) {
    throw new Error(`${label}: esperado HTTP ${expected}, recebido ${result.status}`);
  }
}

function expectOk(label, result) {
  if (!result.ok) {
    throw new Error(`${label}: HTTP ${result.status}`);
  }
}

function assertNoSecrets(output) {
  const serialized = JSON.stringify(output);
  for (const key of ["DATABASE_URL", "JWT_SECRET", "ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "Authorization"]) {
    const value = process.env[key];
    if (value && serialized.includes(value)) {
      throw new Error(`Saida contem segredo: ${key}`);
    }
  }
}

module.exports = {
  PREFIX,
  assertCleanupGuard,
  assertNoSecrets,
  assertSandboxApi,
  assertSeedGuard,
  api,
  expectOk,
  expectStatus,
  hashPassword,
  login,
  password,
  qaEmail,
  redact,
  requireEnv,
  writeCredentials
};
