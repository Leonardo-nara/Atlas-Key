const { performance } = require("node:perf_hooks");

const baseUrl = requiredEnv("LOAD_TEST_API_URL").replace(/\/$/, "");
const label = requiredEnv("LOAD_TEST_ENV_LABEL").toLowerCase();
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10);
const requestsPerEndpoint = Number(process.env.LOAD_TEST_REQUESTS_PER_ENDPOINT ?? 40);
const endpoints = ["/health", "/health/readiness", "/catalog/stores"];

if (!["sandbox", "test", "staging"].includes(label)) {
  fail("LOAD_TEST_ENV_LABEL deve ser sandbox, test ou staging. Carga em producao esta bloqueada.");
}

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
  fail("LOAD_TEST_CONCURRENCY deve ficar entre 1 e 50.");
}

if (!Number.isInteger(requestsPerEndpoint) || requestsPerEndpoint < 1 || requestsPerEndpoint > 500) {
  fail("LOAD_TEST_REQUESTS_PER_ENDPOINT deve ficar entre 1 e 500.");
}

main().catch((error) => fail(error.message));

async function main() {
  const allResults = [];

  for (const endpoint of endpoints) {
    const results = await runEndpoint(endpoint);
    allResults.push(...results);
    printStats(endpoint, results);
  }

  const errors = allResults.filter((result) => result.status >= 500 || result.status === 0);

  if (errors.length > 0) {
    fail(`Carga interrompida: ${errors.length} resposta(s) 5xx/erro de rede.`);
  }
}

async function runEndpoint(endpoint) {
  const queue = Array.from({ length: requestsPerEndpoint }, (_, index) => index);
  const results = [];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      queue.pop();
      results.push(await request(endpoint));
    }
  });

  await Promise.all(workers);
  return results;
}

async function request(endpoint) {
  const start = performance.now();

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { "User-Agent": "mototake-load-smoke/1.0" }
    });

    return {
      status: response.status,
      durationMs: performance.now() - start
    };
  } catch {
    return {
      status: 0,
      durationMs: performance.now() - start
    };
  }
}

function printStats(endpoint, results) {
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const statusCounts = new Map();

  for (const result of results) {
    statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1);
  }

  console.log(JSON.stringify({
    endpoint,
    requests: results.length,
    concurrency,
    statusCounts: Object.fromEntries(statusCounts),
    latencyMs: {
      average: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      max: round(durations.at(-1) ?? 0)
    }
  }));
}

function percentile(values, percentileValue) {
  const index = Math.min(values.length - 1, Math.ceil((percentileValue / 100) * values.length) - 1);
  return round(values[index] ?? 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    fail(`${name} e obrigatoria.`);
  }

  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
