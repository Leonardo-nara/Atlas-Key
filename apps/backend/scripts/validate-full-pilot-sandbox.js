const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { PrismaClient, Prisma } = require("@prisma/client");
const {
  PREFIX,
  api,
  assertNoSecrets,
  assertSandboxApi,
  expectOk,
  expectStatus,
  login,
  qaEmail,
  requireEnv
} = require("./full-pilot-qa-helpers");

const prisma = new PrismaClient();

function credentialsPath() {
  return path.resolve(__dirname, "../../..", ".demo-local", "full-pilot-qa-credentials.json");
}

function readCredentials() {
  const file = credentialsPath();
  if (!fs.existsSync(file)) throw new Error("Credenciais QA nao encontradas. Execute seed-full-pilot-qa antes.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function money(value) {
  return Number(value);
}

function listFromBody(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.results)) return body.results;
  return [];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measure(label, fn) {
  const durations = [];
  let errors = 0;
  for (let index = 0; index < 20; index += 1) {
    const start = performance.now();
    try {
      await fn();
    } catch {
      errors += 1;
    }
    durations.push(Math.round(performance.now() - start));
  }
  return {
    label,
    averageMs: Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length),
    medianMs: median(durations),
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    errors
  };
}

async function main() {
  const apiUrl = requireEnv("FULL_PILOT_QA_API_URL").replace(/\/+$/, "");
  assertSandboxApi(apiUrl);
  const credentials = readCredentials();
  const checks = [];
  const add = (name, status = "OK", details = {}) => checks.push({ name, status, ...details });

  const storeToken = await login(apiUrl, qaEmail("store-admin-a"), credentials.passwords.storeAdminA);
  const storeBToken = await login(apiUrl, qaEmail("store-admin-b"), credentials.passwords.storeAdminB);
  const clientToken = await login(apiUrl, qaEmail("client-a"), credentials.passwords.clientA);
  const courierToken = await login(apiUrl, qaEmail("courier-a"), credentials.passwords.courierA);
  const platformToken = await login(apiUrl, qaEmail("platform-admin"), credentials.passwords.platform);
  add("login roles");

  for (const route of ["/sales", "/cash-registers", "/stock/products", "/reports/overview", "/stores/me/readiness"]) {
    expectStatus(`sem token ${route}`, await api(apiUrl, null, "GET", route), 401);
  }
  expectStatus("client bloqueado em relatorios", await api(apiUrl, clientToken, "GET", "/reports/overview"), 403);
  expectStatus("courier bloqueado em relatorios", await api(apiUrl, courierToken, "GET", "/reports/overview"), 403);
  expectStatus("platform bloqueado em relatorios loja", await api(apiUrl, platformToken, "GET", "/reports/overview"), 403);
  add("401/403 por role");

  const me = await api(apiUrl, storeToken, "GET", "/stores/me");
  expectOk("store me", me);
  assert(me.body.id === credentials.ids.storeA, "STORE_ADMIN A nao esta associado a Store A");

  const products = await api(apiUrl, storeToken, "GET", "/products");
  expectOk("products", products);
  const productItems = listFromBody(products.body);
  assert(productItems.every((item) => item.name.startsWith(PREFIX)), "Produto fora do prefixo QA");
  assert(!productItems.some((item) => item.storeId === credentials.ids.storeB), "Produto da Store B vazou para Store A");
  add("produtos e isolamento");

  const catalogStores = await api(apiUrl, null, "GET", `/catalog/stores?search=${PREFIX}`);
  expectOk("catalog stores", catalogStores);
  assert(listFromBody(catalogStores.body).some((item) => item.id === credentials.ids.storeA), "Store A ausente do catalogo");
  const catalogProducts = await api(apiUrl, null, "GET", `/catalog/stores/${credentials.ids.storeA}/products`);
  expectOk("catalog products", catalogProducts);
  assert(listFromBody(catalogProducts.body).some((item) => item.name.includes("PRODUTO_ZERADO") && item.stockAvailable === false), "Produto zerado nao foi marcado indisponivel");
  add("catalogo cliente");

  const zones = await api(apiUrl, storeToken, "GET", "/stores/me/delivery-zones");
  expectOk("delivery zones", zones);
  assert(listFromBody(zones.body).length >= 3, "Taxas por bairro insuficientes");
  const negativeZone = await api(apiUrl, storeToken, "POST", "/stores/me/delivery-zones", {
    name: `${PREFIX}NEGATIVA`,
    district: "Bairro Erro",
    fee: -1
  });
  expectStatus("taxa negativa", negativeZone, 400);
  add("taxas");

  const normal = productItems.find((item) => item.name.includes("PRODUTO_NORMAL"));
  const low = productItems.find((item) => item.name.includes("PRODUTO_ESTOQUE_BAIXO"));
  assert(normal && low, "Produtos principais nao encontrados");

  const deliveryOrder = await api(apiUrl, clientToken, "POST", "/orders/client", {
    storeId: credentials.ids.storeA,
    fulfillmentType: "DELIVERY",
    addressStreet: "Rua Cliente QA",
    addressNumber: "10",
    addressDistrict: "Bairro Medio",
    addressCity: "Botucatu",
    addressReference: "Referencia QA",
    notes: "Pedido QA delivery completo",
    paymentMethod: "PIX_MANUAL",
    items: [
      { productId: normal.id, quantity: 2 },
      { productId: low.id, quantity: 1 }
    ]
  });
  expectOk("cria pedido delivery", deliveryOrder);
  assert(money(deliveryOrder.body.subtotal) === money(normal.price) * 2 + money(low.price), "Subtotal delivery incorreto");
  assert(money(deliveryOrder.body.suggestedDeliveryFee) === 8, "Taxa sugerida por bairro incorreta");

  const confirmOrder = await api(apiUrl, storeToken, "PATCH", `/orders/${deliveryOrder.body.id}/confirm`, { deliveryFee: 8 });
  expectOk("confirma pedido", confirmOrder);
  const available = await api(apiUrl, courierToken, "GET", "/orders/available");
  expectOk("pedidos disponiveis courier", available);
  assert(listFromBody(available.body).some((item) => item.id === deliveryOrder.body.id), "Pedido confirmado nao apareceu para motoboy");
  const accepted = await api(apiUrl, courierToken, "PATCH", `/orders/${deliveryOrder.body.id}/accept`);
  expectOk("motoboy aceita", accepted);
  expectOk("pedido saiu", await api(apiUrl, courierToken, "PATCH", `/orders/${deliveryOrder.body.id}/status`, { status: "picked_up" }));
  const delivered = await api(apiUrl, courierToken, "PATCH", `/orders/${deliveryOrder.body.id}/status`, { status: "delivered" });
  expectOk("pedido entregue", delivered);
  add("pedido delivery completo");

  const cancelOrder = await api(apiUrl, clientToken, "POST", "/orders/client", {
    storeId: credentials.ids.storeA,
    fulfillmentType: "DELIVERY",
    addressStreet: "Rua Cliente QA",
    addressNumber: "10",
    addressDistrict: "Bairro Baixo",
    addressCity: "Botucatu",
    paymentMethod: "CASH",
    items: [{ productId: normal.id, quantity: 1 }]
  });
  expectOk("cria pedido cancelamento", cancelOrder);
  expectOk("cancela pedido", await api(apiUrl, storeToken, "PATCH", `/orders/${cancelOrder.body.id}/cancel`, { reason: "Cancelamento QA seguro" }));
  add("cancelamento delivery");

  const cashRegisterId = credentials.ids.cashRegister;
  const openCash = await api(apiUrl, storeToken, "POST", `/cash-registers/${cashRegisterId}/open`, { openingAmount: 100, notes: "Abertura QA" });
  expectOk("abre caixa", openCash);
  const sessionId = openCash.body.id;
  expectOk("reforco", await api(apiUrl, storeToken, "POST", `/cash-register-sessions/${sessionId}/cash-in`, { amount: 50, reason: "Reforco QA" }));
  expectOk("sangria", await api(apiUrl, storeToken, "POST", `/cash-register-sessions/${sessionId}/cash-out`, { amount: 20, reason: "Sangria QA" }));

  const sale = await api(apiUrl, storeToken, "POST", "/sales", { customerName: `${PREFIX}CLIENTE_BALCAO`, notes: "Venda QA" });
  expectOk("cria venda", sale);
  expectOk("adiciona item venda", await api(apiUrl, storeToken, "POST", `/sales/${sale.body.id}/items`, { productId: normal.id, quantity: 1, unitPrice: 9999 }));
  const completedSale = await api(apiUrl, storeToken, "POST", `/sales/${sale.body.id}/complete`, {
    cashRegisterSessionId: sessionId,
    payments: [{ method: "CASH", amount: money(normal.price) }]
  });
  expectOk("conclui venda", completedSale);
  const duplicateComplete = await api(apiUrl, storeToken, "POST", `/sales/${sale.body.id}/complete`, {
    cashRegisterSessionId: sessionId,
    payments: [{ method: "CASH", amount: money(normal.price) }]
  });
  assert(duplicateComplete.status >= 400, "Conclusao duplicada nao foi bloqueada");
  const receipt = await api(apiUrl, storeToken, "GET", `/sales/${sale.body.id}/receipt`);
  expectOk("recibo", receipt);
  assert(JSON.stringify(receipt.body).includes("DOCUMENTO SEM VALOR FISCAL"), "Recibo sem aviso nao fiscal");

  const draftSale = await api(apiUrl, storeToken, "POST", "/sales", { customerName: `${PREFIX}DRAFT` });
  expectOk("draft sale", draftSale);
  const cancelledSale = await api(apiUrl, storeToken, "POST", "/sales", { customerName: `${PREFIX}CANCELLED` });
  expectOk("cancel sale create", cancelledSale);
  expectOk("cancel sale", await api(apiUrl, storeToken, "POST", `/sales/${cancelledSale.body.id}/cancel`, { reason: "Cancelamento QA PDV" }));
  add("PDV e recibo");

  const closeCash = await api(apiUrl, storeToken, "POST", `/cash-register-sessions/${sessionId}/close`, {
    countedCashAmount: 155.5,
    notes: "Fechamento QA"
  });
  expectOk("fecha caixa", closeCash);
  const secondOpen = await api(apiUrl, storeToken, "POST", `/cash-registers/${cashRegisterId}/open`, { openingAmount: 0, notes: "Aberto QA" });
  expectOk("caixa aberto adicional", secondOpen);
  add("caixa");

  const reportRoutes = ["/reports/overview", "/reports/sales", "/reports/products", "/reports/payments", "/reports/cash", "/reports/stock"];
  for (const route of reportRoutes) {
    const result = await api(apiUrl, storeToken, "GET", route);
    expectOk(route, result);
    assert(!JSON.stringify(result.body).includes(credentials.ids.storeB), `${route} vazou Store B`);
  }
  add("relatorios");

  for (const route of ["/reports/sales.csv", "/reports/products.csv", "/reports/cash.csv", "/reports/stock.csv"]) {
    const response = await fetch(`${apiUrl}${route}`, { headers: { Authorization: `Bearer ${storeToken}` } });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert(response.ok, `${route} HTTP ${response.status}`);
    assert(buffer.length > 3, `${route} vazio`);
    assert(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf, `${route} sem BOM UTF-8`);
    const text = buffer.toString("utf8");
    assert(!text.includes(credentials.ids.storeB), `${route} vazou Store B`);
    assert(!text.includes("Bearer"), `${route} vazou token`);
    if (route.includes("products")) assert(text.includes("'=FORMULA_CSV"), "CSV nao neutralizou formula");
  }
  add("CSV");

  const readiness = await api(apiUrl, storeToken, "GET", "/stores/me/readiness");
  expectOk("readiness", readiness);
  assert(readiness.body.requiredPercentage === 100 || readiness.body.ready === true, "Prontidao obrigatoria nao atingida");
  add("prontidao");

  const bProducts = await api(apiUrl, storeBToken, "GET", "/products");
  expectOk("Store B products", bProducts);
  assert(listFromBody(bProducts.body).every((item) => item.storeId !== credentials.ids.storeA), "Store B viu produtos da Store A");
  expectStatus("Store B nao acessa sale A", await api(apiUrl, storeBToken, "GET", `/sales/${sale.body.id}`), 404);
  add("isolamento A/B");

  const perf = [];
  perf.push(await measure("readiness", () => api(apiUrl, storeToken, "GET", "/stores/me/readiness")));
  perf.push(await measure("reports overview", () => api(apiUrl, storeToken, "GET", "/reports/overview")));
  perf.push(await measure("sales list", () => api(apiUrl, storeToken, "GET", "/sales")));
  perf.push(await measure("public catalog", () => api(apiUrl, null, "GET", `/catalog/stores/${credentials.ids.storeA}/products`)));
  add("performance", "OK", { perf });

  const db = await prisma.store.findUnique({
    where: { id: credentials.ids.storeA },
    select: {
      _count: {
        select: { orders: true, sales: true, products: true, cashRegisterSessions: true, stockMovements: true }
      }
    }
  });
  assert(db && db._count.orders >= 2 && db._count.sales >= 3, "Banco nao refletiu fluxos QA");
  assert((await prisma.paymentTransaction.count({ where: { order: { storeId: credentials.ids.storeA } } })) === 0, "PDV/delivery manual criou PaymentTransaction indevida");
  add("banco e auditoria operacional");

  const output = {
    result: "OK",
    checks,
    totals: { checks: checks.length },
    credentialsPrinted: false,
    apiUrl
  };
  assertNoSecrets(output);
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
