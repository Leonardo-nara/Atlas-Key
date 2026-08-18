#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const allowedSites = {
  storefront: {
    name: "mototake-demo-cliente",
    id: "95e9d819-f336-4eda-aab6-82ad11d1931e",
    appDir: "apps/storefront",
    filter: "@deliveries/storefront",
    buildCommand: ["pnpm", ["--filter", "@deliveries/storefront", "build"]],
    publishDir: "apps/storefront/dist",
    env: {
      VITE_STORE_API_URL: "https://rotapronta-api-sandbox-production.up.railway.app/api"
    }
  },
  panel: {
    name: "mototake-painel-sandbox",
    id: "be7b5676-72b2-4b2d-906b-2b70e8dbb0a4",
    appDir: "apps/desktop",
    filter: "@deliveries/desktop",
    buildCommand: ["pnpm", ["--filter", "@deliveries/desktop", "build:renderer"]],
    publishDir: "apps/desktop/dist",
    env: {
      VITE_API_URL: "https://rotapronta-api-sandbox-production.up.railway.app/api",
      VITE_SOCKET_URL: "https://rotapronta-api-sandbox-production.up.railway.app"
    }
  }
};

const forbiddenSites = new Set([
  "cb7830bb-d9e1-4cfa-814b-c985b57aa491",
  "mototake-painel",
  "5cf07ecb-c068-4166-8c7a-d04eb4c7a543",
  "mototake-painel-demo"
]);

const args = new Set(process.argv.slice(2));
const app = process.argv.find((arg) => arg.startsWith("--app="))?.split("=")[1];
const site = app ? allowedSites[app] : undefined;

if (!site) {
  fail("Informe --app=storefront ou --app=panel.");
}

if (!args.has("--sandbox")) {
  fail("Deploy bloqueado: use --sandbox para confirmar ambiente sandbox.");
}

if (process.env.MOTOTAKE_NETLIFY_SANDBOX_CONFIRM !== "DEPLOY_SANDBOX_ONLY") {
  fail("Deploy bloqueado: defina MOTOTAKE_NETLIFY_SANDBOX_CONFIRM=DEPLOY_SANDBOX_ONLY.");
}

if (forbiddenSites.has(site.id) || forbiddenSites.has(site.name)) {
  fail(`Deploy bloqueado: destino proibido ${site.name} (${site.id}).`);
}

console.log(`Destino Netlify permitido: ${site.name} (${site.id})`);

const buildEnv = { ...process.env, ...site.env };
run(site.buildCommand[0], site.buildCommand[1], buildEnv);

const redirectsPath = path.resolve(site.publishDir, "_redirects");
if (!existsSync(redirectsPath)) {
  console.warn(`Aviso: ${redirectsPath} nao encontrado. SPA refresh pode falhar.`);
}

run("npx", [
  "netlify",
  "deploy",
  "--filter",
  site.filter,
  "--prod",
  "--no-build",
  "--dir",
  site.publishDir,
  "--site",
  site.id,
  "--message",
  `Mototake sandbox ${app}`
], { ...process.env, NODE_OPTIONS: mergeNodeOptions(process.env.NODE_OPTIONS) });

function run(command, commandArgs, env) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env,
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function mergeNodeOptions(current) {
  const options = current ? current.split(/\s+/).filter(Boolean) : [];
  if (!options.includes("--use-system-ca")) {
    options.push("--use-system-ca");
  }
  return options.join(" ");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
