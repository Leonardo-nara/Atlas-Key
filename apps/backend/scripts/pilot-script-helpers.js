const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VALID_PAYMENT_METHODS = new Set(["CASH", "CARD_ON_DELIVERY", "PIX_MANUAL"]);
const SENSITIVE_ENV_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "PAYMENT_PROOF_S3_SECRET_ACCESS_KEY",
  "IMAGE_S3_SECRET_ACCESS_KEY"
];

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTrim(value) {
  const normalized = trim(value);
  return normalized.length > 0 ? normalized : null;
}

function requiredEnv(name, maxLength = 240) {
  const value = trim(process.env[name]);

  if (!value) {
    throw new Error(`${name} nao configurado`);
  }

  if (value.length > maxLength) {
    throw new Error(`${name} excede o limite de ${maxLength} caracteres`);
  }

  return value;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return trim(email).toLowerCase();
}

function validateStoreName(name) {
  if (name.length < 2 || name.length > 120) {
    throw new Error("PILOT_STORE_NAME deve ter entre 2 e 120 caracteres");
  }
}

function parsePaymentMethods(value) {
  const raw = trim(value);
  if (!raw) {
    return ["CASH", "CARD_ON_DELIVERY"];
  }

  const methods = raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (methods.length === 0) {
    throw new Error("PILOT_PAYMENT_METHODS deve conter pelo menos um metodo valido");
  }

  const invalid = methods.filter((method) => !VALID_PAYMENT_METHODS.has(method));
  if (invalid.length > 0) {
    throw new Error(`Metodos de pagamento nao permitidos nesta fase: ${invalid.join(", ")}`);
  }

  return Array.from(new Set(methods));
}

function buildAddress(input) {
  const parts = [
    input.address,
    input.city,
    input.state,
    input.zipCode ? `CEP ${input.zipCode}` : null
  ].filter(Boolean);

  return parts.join(" - ");
}

function collectPilotInput() {
  const email = normalizeEmail(requiredEnv("PILOT_ADMIN_EMAIL", 160));
  if (!validateEmail(email)) {
    throw new Error("PILOT_ADMIN_EMAIL invalido");
  }

  const storeName = requiredEnv("PILOT_STORE_NAME", 120);
  validateStoreName(storeName);

  const adminName = requiredEnv("PILOT_ADMIN_NAME", 120);
  if (adminName.length < 2) {
    throw new Error("PILOT_ADMIN_NAME deve ter pelo menos 2 caracteres");
  }

  const phone = requiredEnv("PILOT_PHONE", 40);
  const address = requiredEnv("PILOT_ADDRESS", 240);
  const city = requiredEnv("PILOT_CITY", 120);
  const state = requiredEnv("PILOT_STATE", 40);
  const zipCode = requiredEnv("PILOT_ZIP_CODE", 30);
  const timezone = requiredEnv("PILOT_TIMEZONE", 80);
  const paymentMethods = parsePaymentMethods(process.env.PILOT_PAYMENT_METHODS);

  return {
    storeName,
    tradeName: optionalTrim(process.env.PILOT_TRADE_NAME),
    adminName,
    adminEmail: email,
    phone,
    address,
    city,
    state,
    zipCode,
    document: optionalTrim(process.env.PILOT_DOCUMENT),
    slug: optionalTrim(process.env.PILOT_SLUG),
    timezone,
    paymentMethods,
    combinedAddress: buildAddress({ address, city, state, zipCode })
  };
}

function ensureProductionCreateGuard({ apply }) {
  if (!apply) return;

  if (process.env.PILOT_ENV !== "production") {
    throw new Error("Criacao real exige PILOT_ENV=production");
  }

  if (process.env.PILOT_STORE_CONFIRM !== "CREATE_REAL_PILOT_STORE") {
    throw new Error("Criacao real exige PILOT_STORE_CONFIRM=CREATE_REAL_PILOT_STORE");
  }
}

function ensureProductionDeactivateGuard({ apply }) {
  if (!apply) return;

  if (process.env.PILOT_ENV !== "production") {
    throw new Error("Desativacao real exige PILOT_ENV=production");
  }

  if (process.env.PILOT_DEACTIVATE_CONFIRM !== "DEACTIVATE_PILOT_STORE") {
    throw new Error("Desativacao real exige PILOT_DEACTIVATE_CONFIRM=DEACTIVATE_PILOT_STORE");
  }
}

function generateTemporaryPassword() {
  return `${crypto.randomBytes(18).toString("base64url")}aA1!`;
}

function safeSummary(input) {
  return {
    storeName: input.storeName,
    tradeName: input.tradeName,
    adminName: input.adminName,
    adminEmail: input.adminEmail,
    phone: input.phone,
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    documentProvided: Boolean(input.document),
    slug: input.slug,
    timezone: input.timezone,
    paymentMethods: input.paymentMethods
  };
}

function writeLocalCredentials(payload) {
  const root = path.resolve(__dirname, "../../..", ".demo-local");
  fs.mkdirSync(root, { recursive: true });
  const filePath = path.join(root, "pilot-store-credentials.json");
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

function assertNoSensitiveKeys(object) {
  const serialized = JSON.stringify(object);
  for (const key of SENSITIVE_ENV_KEYS) {
    if (process.env[key] && serialized.includes(process.env[key])) {
      throw new Error(`Saida contem valor sensivel de ${key}`);
    }
  }
}

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
}

function isApplyMode() {
  return process.argv.includes("--apply");
}

function normalizeApiUrl(value) {
  const url = trim(value).replace(/\/+$/, "");
  if (!url) throw new Error("PILOT_API_URL nao configurado");
  if (url.includes("sandbox")) {
    throw new Error("PILOT_API_URL nao pode apontar para sandbox na validacao da empresa real");
  }
  return url.endsWith("/api") ? url : `${url}/api`;
}

module.exports = {
  assertNoSensitiveKeys,
  collectPilotInput,
  ensureProductionCreateGuard,
  ensureProductionDeactivateGuard,
  generateTemporaryPassword,
  getArg,
  isApplyMode,
  normalizeApiUrl,
  parsePaymentMethods,
  safeSummary,
  validateEmail,
  writeLocalCredentials
};
