import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiUrl = normalizeUrl(
  process.env.MOTOTAKE_E2E_API_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    "https://rotapronta-api-sandbox-production.up.railway.app/api"
);
const runId = sanitizeRunId(
  process.env.MOTOTAKE_E2E_RUN_ID ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
);
const prefix = sanitizePrefix(
  process.env.MOTOTAKE_E2E_PREFIX ?? `QA_COURIER_UI_CLOUD_${runId}`
);
const qaSlug = prefix;
const password = `Qa${runId.slice(-8).replace(/\D/g, "7")}Strong!1`;
const rootDir = process.cwd();
const templatesDir = path.join(rootDir, ".maestro", "courier");
const generatedDir = path.join(templatesDir, "generated");

const state = {
  prefix: qaSlug,
  storeName: `${qaSlug} Loja`,
  storeOwnerName: `${qaSlug} Operador`,
  storeEmail: `${qaSlug.toLowerCase()}-store@example.test`,
  courierName: `${qaSlug} Motoboy`,
  courierEmail: `${qaSlug.toLowerCase()}-courier@example.test`,
  registeredCourierName: `${qaSlug} Cadastro`,
  registeredCourierEmail: `${qaSlug.toLowerCase()}-register@example.test`,
  clientName: `${qaSlug} Cliente`,
  clientEmail: `${qaSlug.toLowerCase()}-client@example.test`,
  password,
  phone: "11999998888",
  productName: `${qaSlug} Produto Disponivel`,
  apiUrl
};

await assertSandboxUrl(apiUrl);
const seeded = await seedSandboxData();
await generateFlows({ ...state, ...seeded });

console.log(`[courier-e2e] Dados QA preparados no sandbox com prefixo ${qaSlug}.`);
console.log("[courier-e2e] Credenciais temporarias foram gravadas apenas nos YAML gerados no runner.");

async function seedSandboxData() {
  const storeAuth = await post("/auth/register/store", {
    storeName: state.storeName,
    ownerName: state.storeOwnerName,
    email: state.storeEmail,
    password: state.password
  });
  const store = await get("/stores/me", storeAuth.accessToken);
  const product = await post(
    "/products",
    {
      name: state.productName,
      description: "Produto QA para validacao visual cloud do app motoboy.",
      price: 19.9,
      category: "QA",
      available: true
    },
    storeAuth.accessToken
  );

  await post(
    "/stores/me/delivery-zones",
    {
      name: `${qaSlug} Centro`,
      district: "Centro",
      fee: 7.5,
      isActive: true
    },
    storeAuth.accessToken
  );

  const courierAuth = await post("/auth/register/courier", {
    name: state.courierName,
    email: state.courierEmail,
    phone: state.phone,
    password: state.password
  });

  await patch(
    "/couriers/me",
    {
      name: state.courierName,
      phone: state.phone,
      city: "Botucatu",
      vehicleType: "MOTO",
      vehicleModel: "Honda CG",
      plate: "ABC1D23"
    },
    courierAuth.accessToken
  );

  await post("/store-links/request", { storeId: store.id }, courierAuth.accessToken);
  const requests = await get("/store-links/requests", storeAuth.accessToken);
  const link = requests.find(
    (entry) => entry.courier?.email === state.courierEmail && entry.store?.id === store.id
  );

  if (!link) {
    throw new Error("Nao foi possivel localizar o vinculo QA do motoboy.");
  }

  await patch(`/store-links/${link.id}/approve`, undefined, storeAuth.accessToken);

  const clientAuth = await post("/auth/register/client", {
    name: state.clientName,
    email: state.clientEmail,
    phone: state.phone,
    password: state.password
  });

  const order = await post(
    "/orders/client",
    {
      storeId: store.id,
      fulfillmentType: "DELIVERY",
      customerAddress: "Rua QA, 123, Centro, Botucatu",
      addressStreet: "Rua QA",
      addressNumber: "123",
      addressDistrict: "Centro",
      addressCity: "Botucatu",
      paymentMethod: "CASH",
      notes: "Pedido QA para E2E cloud do motoboy.",
      items: [{ productId: product.id, quantity: 1 }]
    },
    clientAuth.accessToken
  );

  await patch(`/orders/${order.id}/confirm`, { deliveryFee: 7.5 }, storeAuth.accessToken);

  return {
    storeId: store.id,
    productId: product.id,
    orderId: order.id
  };
}

async function generateFlows(replacements) {
  await mkdir(generatedDir, { recursive: true });
  const files = (await readdir(templatesDir))
    .filter((file) => file.endsWith(".yaml"))
    .sort();

  for (const file of files) {
    const source = await readFile(path.join(templatesDir, file), "utf8");
    const rendered = renderTemplate(source, replacements);
    await writeFile(path.join(generatedDir, file), rendered, "utf8");
  }

  await writeFile(
    path.join(generatedDir, "runtime.json"),
    JSON.stringify(
      {
        prefix: replacements.prefix,
        storeId: replacements.storeId,
        productId: replacements.productId,
        orderId: replacements.orderId,
        createdAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
}

function renderTemplate(source, replacements) {
  return Object.entries(replacements).reduce(
    (content, [key, value]) =>
      content.replaceAll(`__${key.toUpperCase()}__`, String(value ?? "")),
    source
  );
}

async function post(route, body, token) {
  return request("POST", route, body, token);
}

async function patch(route, body, token) {
  return request("PATCH", route, body, token);
}

async function get(route, token) {
  return request("GET", route, undefined, token);
}

async function request(method, route, body, token) {
  const response = await fetch(`${apiUrl}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${route} falhou com HTTP ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

async function assertSandboxUrl(url) {
  if (!url.includes("rotapronta-api-sandbox-production.up.railway.app")) {
    throw new Error(`URL de API nao permitida para E2E cloud: ${url}`);
  }

  const response = await fetch(`${url}/health`);

  if (!response.ok) {
    throw new Error(`Health do sandbox falhou com HTTP ${response.status}.`);
  }
}

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function sanitizePrefix(value) {
  const normalized = value.trim();

  if (!normalized.startsWith("QA_COURIER_UI_CLOUD_")) {
    throw new Error("MOTOTAKE_E2E_PREFIX deve iniciar com QA_COURIER_UI_CLOUD_");
  }

  return normalized;
}

function sanitizeRunId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
}
