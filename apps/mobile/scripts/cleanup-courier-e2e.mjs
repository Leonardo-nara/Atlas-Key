import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const prefix = process.env.MOTOTAKE_E2E_PREFIX;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const seedStartedPath = resolve(scriptDir, "..", ".maestro", "courier", "generated", "seed-started.json");

if (!prefix || !prefix.startsWith("QA_COURIER_UI_CLOUD_")) {
  throw new Error("MOTOTAKE_E2E_PREFIX ausente ou invalido para limpeza QA.");
}

if (!existsSync(seedStartedPath) && !process.env.DATABASE_URL) {
  console.log("[courier-e2e] Seed nao iniciou; limpeza QA dispensada.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL sandbox ausente. A limpeza QA nao pode ser aprovada sem acesso controlado ao banco sandbox."
  );
}

if (!process.env.DATABASE_URL.includes("railway.internal")) {
  throw new Error("DATABASE_URL nao aparenta ser do Postgres Railway interno sandbox.");
}

const env = {
  ...process.env,
  CLEAN_QA_EXACT_PREFIXES: prefix,
  CLEAN_QA_DATABASE_LABEL: "sandbox",
  CLEAN_QA_CONFIRM: "DELETE_QA_DATA"
};

run("pnpm", ["--filter", "@deliveries/backend", "qa:cleanup:prod"], env);
run("pnpm", ["--filter", "@deliveries/backend", "qa:cleanup:prod", "--", "--apply"], env);
run("pnpm", ["--filter", "@deliveries/backend", "qa:cleanup:prod"], env);

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: new URL("../../..", import.meta.url),
    env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
