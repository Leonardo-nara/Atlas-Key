/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const {
  printSafeContext,
  readManifest,
  requireSandboxSafety
} = require("./readiness-qa-helpers");

const prisma = new PrismaClient();

async function main() {
  const context = requireSandboxSafety();
  printSafeContext(context);
  const manifest = readManifest();
  if (!manifest) throw new Error("Manifesto QA Readiness nao encontrado. Execute o seed com --apply antes.");
  const checks = [];
  const before = await snapshot(manifest);

  const empty = await login(context.apiUrl, manifest.credentials.empty);
  const partial = await login(context.apiUrl, manifest.credentials.partial);
  const ready = await login(context.apiUrl, manifest.credentials.ready);
  const other = await login(context.apiUrl, manifest.credentials.other);
  const client = await login(context.apiUrl, manifest.credentials.client);
  const courier = await login(context.apiUrl, manifest.credentials.courier);
  const platform = await login(context.apiUrl, manifest.credentials.platform);

  await expectStatus(context.apiUrl, "/stores/me/readiness", null, 401, checks, "sem token 401");
  for (const actor of [client, courier, platform]) {
    await expectStatus(context.apiUrl, "/stores/me/readiness", actor.accessToken, 403, checks, `role ${actor.user.role} 403`);
  }

  await validateScenario(context.apiUrl, empty.accessToken, manifest.expected.empty, manifest.ids.emptyStore, checks, "empty");
  await validateScenario(context.apiUrl, partial.accessToken, manifest.expected.partial, manifest.ids.partialStore, checks, "partial");
  await validateScenario(context.apiUrl, ready.accessToken, manifest.expected.ready, manifest.ids.readyStore, checks, "ready");
  await validateScenario(context.apiUrl, other.accessToken, manifest.expected.other, manifest.ids.otherStore, checks, "other");

  const externalStoreResponse = await getJson(context.apiUrl, `/stores/me/readiness?storeId=${manifest.ids.otherStore}`, ready.accessToken);
  checkMetric(checks, "storeId externo ignorado", manifest.ids.readyStore, externalStoreResponse.storeId);
  checkMetric(checks, "sem pixKey sensivel", false, JSON.stringify(externalStoreResponse).includes("pixKey"));
  checkMetric(checks, "sem passwordHash", false, JSON.stringify(externalStoreResponse).includes("passwordHash"));
  checkMetric(checks, "sem dados da outra loja", false, JSON.stringify(externalStoreResponse).includes(manifest.ids.otherStore));

  const after = await snapshot(manifest);
  checkMetric(checks, "endpoint somente leitura", JSON.stringify(before), JSON.stringify(after));

  console.table(checks.map((check) => ({ check: check.name, expected: check.expected, returned: check.returned, ok: check.ok })));
  const failures = checks.filter((check) => !check.ok);
  if (failures.length > 0) {
    throw new Error(`${failures.length} divergencias encontradas na validacao de readiness.`);
  }
  console.log(`Validacao QA Readiness concluida: ${checks.length} checks OK.`);
}

async function validateScenario(apiUrl, token, expected, expectedStoreId, checks, label) {
  const readiness = await getJson(apiUrl, "/stores/me/readiness", token);
  checkMetric(checks, `${label} storeId`, expectedStoreId, readiness.storeId);
  checkMetric(checks, `${label} ready`, expected.ready, readiness.ready);
  checkMetric(checks, `${label} percentage`, expected.percentage, readiness.percentage);
  checkMetric(checks, `${label} categorias validas`, true, readiness.items.every((item) => ["REQUIRED", "RECOMMENDED", "OPTIONAL"].includes(item.category)));
  checkMetric(checks, `${label} required define ready`, readiness.ready, readiness.completedRequiredItems === readiness.totalRequiredItems);
  checkMetric(checks, `${label} rotas existem`, true, readiness.items.every((item) => typeof item.route === "string" && item.route.startsWith("/")));
}

async function login(apiUrl, credentials) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) {
    throw new Error(`Login falhou para ${credentials.email}: ${response.status}`);
  }
  return response.json();
}

async function getJson(apiUrl, path, token) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`${path} retornou ${response.status}`);
  return response.json();
}

async function expectStatus(apiUrl, path, token, expected, checks, name) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  checkMetric(checks, name, expected, response.status);
}

async function snapshot(manifest) {
  const storeIds = [
    manifest.ids.emptyStore,
    manifest.ids.partialStore,
    manifest.ids.readyStore,
    manifest.ids.otherStore
  ];
  const userIds = [
    manifest.ids.emptyOwner,
    manifest.ids.partialOwner,
    manifest.ids.readyOwner,
    manifest.ids.otherOwner,
    manifest.ids.client,
    manifest.ids.courier,
    manifest.ids.platform
  ];
  const [stores, users, products, zones, sales, orders, registers, links] = await Promise.all([
    prisma.store.count({ where: { id: { in: storeIds } } }),
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.product.count({ where: { storeId: { in: storeIds } } }),
    prisma.storeDeliveryZone.count({ where: { storeId: { in: storeIds } } }),
    prisma.sale.count({ where: { storeId: { in: storeIds } } }),
    prisma.order.count({ where: { storeId: { in: storeIds } } }),
    prisma.cashRegister.count({ where: { storeId: { in: storeIds } } }),
    prisma.storeCourierLink.count({ where: { OR: [{ storeId: { in: storeIds } }, { courierId: { in: userIds } }] } })
  ]);

  return { stores, users, products, zones, sales, orders, registers, links };
}

function checkMetric(checks, name, expected, returned) {
  const ok = Object.is(expected, returned);
  checks.push({ name, expected, returned, ok });
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
