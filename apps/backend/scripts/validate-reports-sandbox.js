/* eslint-disable no-console */
const {
  printSafeContext,
  readManifest,
  requireSandboxSafety
} = require("./reports-qa-helpers");

async function main() {
  const context = requireSandboxSafety();
  printSafeContext(context);
  const manifest = readManifest();
  if (!manifest) throw new Error("Manifesto QA Reports nao encontrado. Execute o seed com --apply antes.");
  const apiUrl = context.apiUrl;
  const checks = [];

  const storeA = await login(apiUrl, manifest.credentials.storeA);
  const storeB = await login(apiUrl, manifest.credentials.storeB);
  const client = await login(apiUrl, manifest.credentials.client);
  const courier = await login(apiUrl, manifest.credentials.courier);
  const platform = await login(apiUrl, manifest.credentials.platform);

  await expectStatus(apiUrl, "/reports/overview", null, 401, checks, "sem token bloqueado");
  for (const actor of [client, courier, platform]) {
    await expectStatus(apiUrl, "/reports/overview", actor.accessToken, 403, checks, `role ${actor.user.role} bloqueada`);
  }

  const overviewA = await getJson(apiUrl, "/reports/overview?period=today", storeA.accessToken);
  checkMetric(checks, "Total vendido", manifest.expected.overviewA.soldAmount, overviewA.sales.soldAmount);
  checkMetric(checks, "Total recebido", manifest.expected.overviewA.paidAmount, overviewA.sales.paidAmount);
  checkMetric(checks, "Total pendente", manifest.expected.overviewA.pendingAmount, overviewA.sales.pendingAmount);
  checkMetric(checks, "Quantidade realizada", manifest.expected.overviewA.realizedCount, overviewA.sales.realizedCount);
  checkMetric(checks, "Ticket medio", manifest.expected.overviewA.averageTicket, overviewA.sales.averageTicket);
  checkMetric(checks, "PDV realizado", manifest.expected.overviewA.pdvSoldAmount, overviewA.sales.pdvSoldAmount);
  checkMetric(checks, "Delivery realizado", manifest.expected.overviewA.deliverySoldAmount, overviewA.sales.deliverySoldAmount);
  checkMetric(checks, "Diferenca de caixa", manifest.expected.overviewA.closedCashDifferenceAmount, overviewA.operation.closedCashDifferenceAmount);
  checkMetric(checks, "Timezone", "America/Sao_Paulo", overviewA.period.timezone);

  const overviewB = await getJson(apiUrl, "/reports/overview?period=today", storeB.accessToken);
  checkMetric(checks, "Loja B vendido", manifest.expected.overviewB.soldAmount, overviewB.sales.soldAmount);
  checkMetric(checks, "Loja B recebido", manifest.expected.overviewB.paidAmount, overviewB.sales.paidAmount);

  const salesA = await getJson(apiUrl, "/reports/sales?period=today&page=1&limit=25", storeA.accessToken);
  checkMetric(checks, "Sales total A", 4, salesA.total);
  checkMetric(checks, "Sales default page", 1, salesA.page);
  checkMetric(checks, "Sales limit", 25, salesA.limit);
  ensureNoStoreBData(checks, "sales json A", JSON.stringify(salesA));

  const pdvSales = await getJson(apiUrl, "/reports/sales?period=today&origin=PDV&status=COMPLETED&paymentMethod=CASH&paymentStatus=PAID", storeA.accessToken);
  checkMetric(checks, "Filtro PDV cash paid", 1, pdvSales.total);
  checkMetric(checks, "Filtro PDV cash sold", 100, pdvSales.items[0]?.soldAmount);

  const deliverySales = await getJson(apiUrl, "/reports/sales?period=today&origin=DELIVERY&status=DELIVERED&paymentMethod=CARD_ON_DELIVERY&paymentStatus=PAID", storeA.accessToken);
  checkMetric(checks, "Filtro delivery delivered", 1, deliverySales.total);
  checkMetric(checks, "Filtro delivery sold", 80, deliverySales.items[0]?.soldAmount);

  const searchA = await getJson(apiUrl, "/reports/sales?period=today&search=aspas", storeA.accessToken);
  checkMetric(checks, "Busca cliente aspas", 1, searchA.total);

  const productsA = await getJson(apiUrl, "/reports/products?period=today", storeA.accessToken);
  const snapshotProduct = productsA.items.find((item) => item.product.id === manifest.ids?.productA1 || item.product.name === "Produto Snapshot Atualizado");
  checkMetric(checks, "Produto snapshot quantidade total", 3, snapshotProduct?.totalQuantitySold);
  checkMetric(checks, "Produto snapshot vendido", 180, snapshotProduct?.soldAmount);
  ensureNoStoreBData(checks, "products json A", JSON.stringify(productsA));

  const paymentsA = await getJson(apiUrl, "/reports/payments?period=today", storeA.accessToken);
  checkMetric(checks, "Pagamentos contem CASH", true, paymentsA.items.some((item) => item.origin === "PDV" && item.paymentMethod === "CASH" && item.paidAmount === 70));
  checkMetric(checks, "Pagamentos contem CARD pendente", true, paymentsA.items.some((item) => item.origin === "PDV" && item.paymentMethod === "CARD" && item.pendingAmount === 30));
  checkMetric(checks, "Pagamentos contem CARD_ON_DELIVERY", true, paymentsA.items.some((item) => item.origin === "DELIVERY" && item.paymentMethod === "CARD_ON_DELIVERY" && item.paidAmount === 80));

  const cashA = await getJson(apiUrl, "/reports/cash?period=today", storeA.accessToken);
  const closed = cashA.items.find((item) => item.id === "qa_reports_cash_session_closed_a");
  const open = cashA.items.find((item) => item.id === "qa_reports_cash_session_open_a");
  checkMetric(checks, "Caixa esperado", 130, closed?.expectedCashAmount);
  checkMetric(checks, "Caixa contado", 125, closed?.countedCashAmount);
  checkMetric(checks, "Caixa diferenca", -5, closed?.differenceAmount);
  checkMetric(checks, "Caixa aberto diferenca nula", null, open?.differenceAmount);

  const stockA = await getJson(apiUrl, "/reports/stock?period=today", storeA.accessToken);
  const controlled = stockA.items.find((item) => item.product.id === "qa_reports_product_a_snapshot");
  const noControl = stockA.items.find((item) => item.product.id === "qa_reports_product_a_no_control");
  checkMetric(checks, "Estoque reservas", 1, controlled?.deliveryReservations);
  checkMetric(checks, "Estoque baixas PDV", 2, controlled?.pdvOutputs);
  checkMetric(checks, "Produto sem controle nao zerado", "NO_CONTROL", noControl?.stockStatus);

  await expectStatus(apiUrl, "/reports/overview?period=custom&dateFrom=invalida&dateTo=2026-01-01", storeA.accessToken, 400, checks, "custom invalido 400");
  await expectStatus(apiUrl, "/reports/overview?period=custom&dateFrom=2026-02-01&dateTo=2026-01-01", storeA.accessToken, 400, checks, "custom invertido 400");
  await expectStatus(apiUrl, "/reports/overview?period=custom&dateFrom=2025-01-01&dateTo=2026-12-31", storeA.accessToken, 400, checks, "periodo >366 400");
  await expectStatus(apiUrl, "/reports/sales?limit=101", storeA.accessToken, 400, checks, "limit >100 400");

  for (const endpoint of ["/reports/sales.csv", "/reports/products.csv", "/reports/cash.csv", "/reports/stock.csv"]) {
    const csv = await getCsv(apiUrl, `${endpoint}?period=today`, storeA.accessToken);
    checkMetric(checks, `${endpoint} status`, 200, csv.status);
    checkMetric(checks, `${endpoint} BOM`, true, csv.hasBom);
    checkMetric(checks, `${endpoint} content-type`, true, csv.contentType.includes("text/csv"));
    checkMetric(checks, `${endpoint} disposition`, true, csv.contentDisposition.includes("attachment"));
    ensureNoStoreBData(checks, `${endpoint} A`, csv.text);
    ensureNoSensitiveData(checks, endpoint, csv.text);
  }

  const salesCsvB = await getCsv(apiUrl, "/reports/sales.csv?period=today", storeB.accessToken);
  for (const expected of ["\"'=Cliente", "\"'+Cliente", "\"'-Cliente", "\"'@Cliente", "\"'\tCliente", "\"'\rCliente", "\"'\nCliente"]) {
    checkMetric(checks, `CSV vendas injection ${JSON.stringify(expected)}`, true, salesCsvB.text.includes(expected));
  }
  ensureNoSensitiveData(checks, "sales csv B", salesCsvB.text);

  const productsCsvB = await getCsv(apiUrl, "/reports/products.csv?period=today", storeB.accessToken);
  for (const expected of ["\"'=Produto", "\"'+Produto", "\"'-Produto", "\"'@Produto", "\"'\tProduto", "\"'\rProduto", "\"'\nProduto"]) {
    checkMetric(checks, `CSV produtos injection ${JSON.stringify(expected)}`, true, productsCsvB.text.includes(expected));
  }
  ensureNoSensitiveData(checks, "products csv B", productsCsvB.text);

  const failures = checks.filter((check) => !check.ok);
  console.table(checks.map((check) => ({ check: check.name, expected: check.expected, returned: check.returned, ok: check.ok })));
  if (failures.length > 0) {
    throw new Error(`${failures.length} divergencias encontradas na validacao de relatorios.`);
  }
  console.log(`Validacao concluida: ${checks.length} checks OK.`);
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

async function getCsv(apiUrl, path, token) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    hasBom: buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF,
    text: buffer.toString("utf8"),
    contentType: response.headers.get("content-type") || "",
    contentDisposition: response.headers.get("content-disposition") || ""
  };
}

function checkMetric(checks, name, expected, returned) {
  const ok = Object.is(expected, returned);
  checks.push({ name, expected, returned, ok });
}

function ensureNoStoreBData(checks, label, text) {
  for (const forbidden of ["999", "Produto Loja B", "Produto Exclusivo Loja B", "Cliente Loja B", "qa_reports_store_b", "qa_reports_product_b"]) {
    checkMetric(checks, `${label} sem ${forbidden}`, false, text.includes(forbidden));
  }
}

function ensureNoSensitiveData(checks, label, text) {
  for (const forbidden of ["accessToken", "refreshToken", "passwordHash", "DATABASE_URL", "JWT_SECRET", "ASAAS_API_KEY", "qa_reports_owner_b"]) {
    checkMetric(checks, `${label} sem sensivel ${forbidden}`, false, text.includes(forbidden));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
