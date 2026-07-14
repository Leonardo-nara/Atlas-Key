/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const EXPECTED_PROJECT = "rotapronta-asaas-sandbox";
const EXPECTED_SERVICE = "rotapronta-api-sandbox";
const EXPECTED_API_URL = "https://rotapronta-api-sandbox-production.up.railway.app/api";
const STORE_EMPTY_NAME = "QA_READINESS_STORE_EMPTY";
const STORE_PARTIAL_NAME = "QA_READINESS_STORE_PARTIAL";
const STORE_READY_NAME = "QA_READINESS_STORE_READY";
const STORE_OTHER_NAME = "QA_READINESS_STORE_OTHER";
const MANIFEST_PATH = path.join(__dirname, "..", ".qa-readiness-manifest.json");

function requireSandboxSafety({ writeConfirm, cleanupConfirm } = {}) {
  const apiUrl = normalizeApiUrl(process.env.QA_READINESS_API_URL || EXPECTED_API_URL);
  const databaseUrl = process.env.DATABASE_URL || "";
  const railwayProject = process.env.RAILWAY_PROJECT_NAME || "";
  const railwayService = process.env.RAILWAY_SERVICE_NAME || "";
  const railwayEnvironment = process.env.RAILWAY_ENVIRONMENT_NAME || "";
  const databaseHost = getDatabaseHost(databaseUrl);

  const failures = [];
  if (process.env.QA_READINESS_ENV !== "sandbox") failures.push("QA_READINESS_ENV precisa ser sandbox.");
  if (process.env.NODE_ENV === "production" && process.env.QA_READINESS_ALLOW_NODE_ENV_PRODUCTION !== "true") {
    failures.push("NODE_ENV=production bloqueado para scripts QA, salvo override explicito de sandbox.");
  }
  if (railwayProject !== EXPECTED_PROJECT) failures.push(`Projeto Railway invalido: ${railwayProject || "(ausente)"}.`);
  if (railwayService !== EXPECTED_SERVICE) failures.push(`Servico Railway invalido: ${railwayService || "(ausente)"}.`);
  if (railwayEnvironment !== "production") failures.push(`Ambiente Railway sandbox esperado como production, recebido: ${railwayEnvironment || "(ausente)"}.`);
  if (apiUrl !== EXPECTED_API_URL) failures.push(`API URL invalida: ${apiUrl}.`);
  if (!databaseUrl) failures.push("DATABASE_URL ausente.");
  if (!/railway\.internal|railway\.app|proxy\.rlwy\.net/i.test(databaseHost)) {
    failures.push(`Host do banco nao parece Railway sandbox: ${databaseHost || "(ausente)"}.`);
  }
  if (/rotapronta-api-production\.up\.railway\.app/i.test(apiUrl)) failures.push("API de producao detectada.");
  if (writeConfirm && process.env.QA_READINESS_CONFIRM !== "CREATE_READINESS_QA") {
    failures.push("Criacao bloqueada. Defina QA_READINESS_CONFIRM=CREATE_READINESS_QA.");
  }
  if (cleanupConfirm && process.env.QA_READINESS_CLEANUP_CONFIRM !== "DELETE_READINESS_QA") {
    failures.push("Limpeza bloqueada. Defina QA_READINESS_CLEANUP_CONFIRM=DELETE_READINESS_QA.");
  }

  if (failures.length > 0) {
    console.error("Protecoes do sandbox bloquearam a execucao:");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(`Contexto seguro: project=${railwayProject || "(ausente)"} service=${railwayService || "(ausente)"} env=${railwayEnvironment || "(ausente)"} dbHost=${databaseHost || "(ausente)"} api=${apiUrl}`);
    process.exit(1);
  }

  return { apiUrl, railwayProject, railwayService, railwayEnvironment, databaseHost };
}

function normalizeApiUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function getDatabaseHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "";
  }
}

function assertQaStoreNames(stores) {
  const allowedNames = new Set([STORE_EMPTY_NAME, STORE_PARTIAL_NAME, STORE_READY_NAME, STORE_OTHER_NAME]);
  for (const store of stores) {
    if (!allowedNames.has(store.name)) {
      throw new Error(`Loja fora do escopo QA Readiness detectada: ${store.name}`);
    }
    if (store.name === "DEMO Mototake") {
      throw new Error("Loja DEMO Mototake bloqueada.");
    }
  }
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function removeManifest() {
  if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH);
}

function generatePassword() {
  return `QaReady-${crypto.randomBytes(12).toString("base64url")}#7`;
}

function printSafeContext(context) {
  console.log(`Projeto Railway: ${context.railwayProject}`);
  console.log(`Servico Railway: ${context.railwayService}`);
  console.log(`Ambiente Railway: ${context.railwayEnvironment}`);
  console.log(`Host do banco: ${context.databaseHost}`);
  console.log(`API sandbox: ${context.apiUrl}`);
}

module.exports = {
  EXPECTED_API_URL,
  MANIFEST_PATH,
  STORE_EMPTY_NAME,
  STORE_PARTIAL_NAME,
  STORE_READY_NAME,
  STORE_OTHER_NAME,
  assertQaStoreNames,
  generatePassword,
  printSafeContext,
  readManifest,
  removeManifest,
  requireSandboxSafety,
  writeManifest
};
