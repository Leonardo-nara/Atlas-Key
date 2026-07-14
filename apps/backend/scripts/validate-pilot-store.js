const {
  assertNoSensitiveKeys,
  normalizeApiUrl,
  requiredEnv,
  validateEmail
} = (() => {
  const helpers = require("./pilot-script-helpers");
  return {
    assertNoSensitiveKeys: helpers.assertNoSensitiveKeys,
    normalizeApiUrl: helpers.normalizeApiUrl,
    requiredEnv: (name) => {
      const value = process.env[name]?.trim();
      if (!value) throw new Error(`${name} nao configurado`);
      return value;
    },
    validateEmail: helpers.validateEmail
  };
})();

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  return { status: response.status, body };
}

async function getProtected(apiUrl, token, path) {
  return requestJson(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

function ensureOk(label, result) {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} retornou HTTP ${result.status}`);
  }
}

async function main() {
  const apiUrl = normalizeApiUrl(requiredEnv("PILOT_API_URL"));
  const expectedStoreId = requiredEnv("PILOT_EXPECTED_STORE_ID");
  const email = requiredEnv("PILOT_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("PILOT_ADMIN_PASSWORD");

  if (!validateEmail(email)) {
    throw new Error("PILOT_ADMIN_EMAIL invalido");
  }

  const login = await requestJson(`${apiUrl}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  ensureOk("login", login);

  const token = login.body?.accessToken;
  if (!token) {
    throw new Error("Login nao retornou accessToken");
  }

  const checks = [];
  const addCheck = (name, result, predicate = () => true) => {
    ensureOk(name, result);
    if (!predicate(result.body)) {
      throw new Error(`${name} retornou dados inconsistentes`);
    }
    checks.push({ name, status: result.status });
  };

  addCheck("usuario atual", await getProtected(apiUrl, token, "/users/me"), (body) => body.role === "STORE_ADMIN" && body.email === email);
  addCheck("loja atual", await getProtected(apiUrl, token, "/stores/me"), (body) => body.id === expectedStoreId);
  addCheck("prontidao", await getProtected(apiUrl, token, "/stores/me/readiness"));
  addCheck("dashboard", await getProtected(apiUrl, token, "/stores/me/dashboard"));
  addCheck("produtos", await getProtected(apiUrl, token, "/products"));
  addCheck("taxas", await getProtected(apiUrl, token, "/stores/me/delivery-zones"));
  addCheck("pix manual", await getProtected(apiUrl, token, "/stores/me/pix-settings"));
  addCheck("caixas", await getProtected(apiUrl, token, "/cash-registers"));
  addCheck("estoque", await getProtected(apiUrl, token, "/stock/summary"));
  addCheck("relatorio resumo", await getProtected(apiUrl, token, "/reports/overview"));

  const adminAttempt = await getProtected(apiUrl, token, "/admin/stores");
  if (adminAttempt.status !== 403) {
    throw new Error(`isolamento admin esperado 403, recebido ${adminAttempt.status}`);
  }
  checks.push({ name: "isolamento admin", status: adminAttempt.status });

  const output = {
    apiUrl,
    expectedStoreId,
    adminEmail: email,
    checks,
    sandboxReference: apiUrl.includes("sandbox") ? "ERRO" : "OK"
  };

  assertNoSensitiveKeys(output);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
