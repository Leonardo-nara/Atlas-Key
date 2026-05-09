const { spawnSync } = require("node:child_process");
const path = require("node:path");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..", "..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const databaseUrl =
  process.env.DATABASE_URL_E2E ??
  "postgresql://postgres:postgres@localhost:5433/delivery_platform?schema=rotapronta_e2e";

assertSafeE2eDatabaseUrl(databaseUrl);

const env = {
  ...process.env,
  NODE_ENV: "test",
  API_PREFIX: "api",
  DATABASE_URL: databaseUrl,
  JWT_SECRET:
    process.env.JWT_SECRET ??
    "rotapronta-e2e-test-secret-with-enough-length-for-local-tests",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  JWT_REFRESH_EXPIRES_DAYS: process.env.JWT_REFRESH_EXPIRES_DAYS ?? "30",
  PAYMENT_PROOF_STORAGE_DRIVER: "local",
  PAYMENT_PROOF_STORAGE_DIR:
    process.env.PAYMENT_PROOF_STORAGE_DIR ?? "./tmp/e2e-payment-proofs",
  IMAGE_STORAGE_DRIVER: "local",
  IMAGE_STORAGE_DIR: process.env.IMAGE_STORAGE_DIR ?? "./tmp/e2e-images",
  SENTRY_DSN: ""
};

runPnpm(["exec", "prisma", "migrate", "reset", "--force", "--skip-seed"]);
runPnpm(["build:test"]);
run("node", [
  "--test",
  "--test-isolation=none",
  "dist-test/tests/ownership-real.e2e-spec.js"
]);

function runPnpm(args) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args]);
    return;
  }

  run(process.platform === "win32" ? "pnpm.ps1" : "pnpm", args);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertSafeE2eDatabaseUrl(url) {
  const normalized = url.toLowerCase();
  const isProductionLike =
    normalized.includes("render.com") ||
    normalized.includes("onrender") ||
    normalized.includes("amazonaws.com") ||
    normalized.includes("neon.tech") ||
    normalized.includes("supabase.co");
  const isClearlyTestUrl = normalized.includes("e2e") || normalized.includes("test");

  if (isProductionLike) {
    throw new Error(
      "DATABASE_URL_E2E aponta para um host de producao/remoto. Use um banco local isolado."
    );
  }

  if (!isClearlyTestUrl) {
    throw new Error(
      "DATABASE_URL_E2E precisa conter 'e2e' ou 'test' no banco/schema para evitar limpeza acidental."
    );
  }
}
