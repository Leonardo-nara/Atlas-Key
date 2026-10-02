import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

import { AuthService } from "../src/auth/auth.service";
import { JwtStrategy } from "../src/auth/jwt.strategy";
import { UserRole } from "../src/common/enums/user-role.enum";
import { BadRequestException, Logger } from "@nestjs/common";
import { requestLoggingMiddleware } from "../src/common/observability/request-logging.middleware";
import { PaymentGatewayService } from "../src/orders/payment-gateway.service";
import { Prisma } from "@prisma/client";
import { OrdersRealtimeGateway } from "../src/realtime/orders-realtime.gateway";
import type { Socket } from "socket.io";
import { sanitizeLogData, sanitizeRequestPath } from "../src/common/observability/sanitize-log-data";
import { ImageStorageService } from "../src/common/storage/image-storage.service";
import { PaymentProofStorageService } from "../src/orders/payment-proof-storage.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import { PrismaService } from "../src/prisma/prisma.service";

const secret = "synthetic-local-security-test-key-only";

describe("courier available delivery push", () => {
  for (const scenario of [
    { event: "orders.available", clientId: null, enabled: true, expected: 3 },
    { event: "orders.created", clientId: "client-a", enabled: true, expected: 0 },
    { event: "orders.available", clientId: "client-a", enabled: true, expected: 3 },
    { event: "orders.status_updated", clientId: null, enabled: true, expected: 0 },
    { event: "orders.created", clientId: null, enabled: false, expected: 0 }
  ]) {
    it(`${scenario.event} client=${scenario.clientId} enabled=${scenario.enabled}`, async () => {
      const originalFlag = process.env.PUSH_NOTIFICATIONS_ENABLED;
      const originalFetch = global.fetch;
      const batches: Array<Array<{ title: string; body: string; data: Record<string, string> }>> = [];
      const prisma = {
        store: { findUnique: async () => null },
        storeCourierLink: { findMany: async (query: { where: unknown }) => {
          assert.deepEqual(query.where, {
            storeId: "store-a", status: "APPROVED",
            store: { active: true, status: "ACTIVE" },
            courier: { role: "COURIER", active: true, status: "ACTIVE" }
          });
          return [{ courierId: "courier-a" }];
        } },
        deviceToken: { findMany: async (query: { where: { userId: { in: string[] } } }) => {
          if (!query.where.userId.in.includes("courier-a")) return [];
          return Array.from({ length: 205 }, (_, i) => ({ id: String(i), token: `ExpoPushToken[synthetic-${i}]` }));
        } }
      } as unknown as PrismaService;
      try {
        process.env.PUSH_NOTIFICATIONS_ENABLED = String(scenario.enabled);
        global.fetch = async (_url, options) => {
          batches.push(JSON.parse(String(options?.body)));
          return new Response("{}", { status: 200 });
        };
        new NotificationsService(prisma).notifyOrderEvent(scenario.event, {
          id: "order-a", storeId: "store-a", clientId: scenario.clientId,
          status: "PENDING", customerName: "Sensitive customer name"
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(batches.length, scenario.expected);
        for (const batch of batches) {
          assert.ok(batch.length <= 100);
          assert.equal(batch[0].title, "Nova entrega dispon\u00edvel");
          assert.equal(batch[0].body, "Nova entrega dispon\u00edvel no Mototake. Abra o app para conferir e aceitar.");
          assert.deepEqual(batch[0].data, { type: "order.available", orderId: "order-a" });
          assert.ok(!JSON.stringify(batch).includes("Sensitive customer name"));
        }
      } finally {
        global.fetch = originalFetch;
        if (originalFlag === undefined) delete process.env.PUSH_NOTIFICATIONS_ENABLED;
        else process.env.PUSH_NOTIFICATIONS_ENABLED = originalFlag;
      }
    });
  }
});

async function authHarness() {
  const refreshToken = "session-a.synthetic-secret";
  const session = {
    id: "session-a", userId: "user-a", revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 60_000),
    refreshTokenHash: await bcrypt.hash(refreshToken, 4),
    user: { id: "user-a", email: "synthetic@example.invalid", name: "QA", role: UserRole.CLIENT, active: true, status: "ACTIVE" }
  };
  const prisma = {
    authSession: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === session.id ? { ...session } : null,
      update: async ({ data }: { data: Partial<typeof session> }) => Object.assign(session, data),
      updateMany: async ({ where, data }: { where: { id: string; refreshTokenHash: string }; data: Partial<typeof session> }) => {
        if (where.id !== session.id || where.refreshTokenHash !== session.refreshTokenHash || session.revokedAt) return { count: 0 };
        Object.assign(session, data);
        return { count: 1 };
      }
    },
    authAuditEvent: { create: async () => ({}) }
  };
  const service = new AuthService(prisma as never, new JwtService({ secret }), new ConfigService(), {} as never);
  return { service, session, refreshToken };
}

describe("security hardening: sessions", () => {
  it("invalid refresh suffix cannot revoke a known session", async () => {
    const { service, session } = await authHarness();
    await service.logout({ refreshToken: "session-a.invalid-secret" });
    assert.equal(session.revokedAt, null);
  });

  it("valid logout revokes once and remains idempotent", async () => {
    const { service, session, refreshToken } = await authHarness();
    await service.logout({ refreshToken });
    assert.ok(session.revokedAt);
    const revokedAt = session.revokedAt;
    await service.logout({ refreshToken });
    assert.equal(session.revokedAt, revokedAt);
  });

  it("changing session id does not revoke another session", async () => {
    const { service, session } = await authHarness();
    await service.logout({ refreshToken: "session-b.synthetic-secret" });
    assert.equal(session.revokedAt, null);
  });

  it("parallel refresh has one winner without revoking its session", async () => {
    const { service, session, refreshToken } = await authHarness();
    const results = await Promise.allSettled([service.refresh({ refreshToken }), service.refresh({ refreshToken })]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    assert.equal(session.revokedAt, null);
    await assert.rejects(() => service.refresh({ refreshToken }));
    assert.equal(session.revokedAt, null);
  });

  for (const state of ["missing-sid", "unknown-session", "revoked", "wrong-user", "valid"] as const) {
    it(`JWT session validation: ${state}`, async () => {
      const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: secret }), {
        user: { findUnique: async () => ({ id: "user-a", email: "synthetic@example.invalid", role: UserRole.CLIENT, active: true, status: "ACTIVE" }) },
        authSession: { findFirst: async ({ where }: { where: { id: string; userId: string; revokedAt: unknown; expiresAt: { gt: Date } } }) => {
          assert.equal(where.id, "session-a");
          assert.equal(where.userId, "user-a");
          assert.equal(where.revokedAt, null);
          assert.ok(where.expiresAt.gt instanceof Date);
          return state === "valid" ? { id: "session-a" } : null;
        } }
      } as never);
      const payload = { sub: "user-a", email: "synthetic@example.invalid", role: UserRole.CLIENT, ...(state === "missing-sid" ? {} : { sid: "session-a" }) };
      const jwt = new JwtService({ secret });
      const verified = await jwt.verifyAsync<typeof payload>(jwt.sign(payload, { expiresIn: 60 }));
      if (state === "valid") assert.equal((await strategy.validate(verified)).sessionId, "session-a");
      else await assert.rejects(() => strategy.validate(verified));
    });
  }
});

export function webhookHarness() {
  const transaction = {
    id: "tx-qa", orderId: "order-qa", provider: "ASAAS", providerPaymentId: "pay-qa",
    status: "PENDING", amount: new Prisma.Decimal(50), currency: "BRL", paidAt: null,
    metadataJson: null, rawStatus: "PENDING", order: { paymentStatus: "PENDING" }
  };
  let events = 0;
  const clone = () => ({ ...transaction, order: { ...transaction.order } });
  const tx = {
    $queryRaw: async () => [{ id: transaction.id }],
    paymentTransaction: {
      findUnique: async () => clone(),
      update: async ({ data }: { data: Partial<typeof transaction> }) => Object.assign(transaction, data)
    },
    order: {
      update: async () => { transaction.order.paymentStatus = "PAID"; },
      updateMany: async () => {
        if (transaction.order.paymentStatus === "PAID") return { count: 0 };
        transaction.order.paymentStatus = "PAID"; return { count: 1 };
      }
    },
    orderEvent: { create: async () => { events++; } }
  };
  let tail = Promise.resolve();
  const prisma = {
    paymentTransaction: { findFirst: async () => clone() },
    $transaction: <T>(callback: (client: typeof tx) => Promise<T>) => {
      // Emulate DB serialization; stale reads outside the transaction still reproduce the old bug.
      const result = tail.then(() => callback(tx));
      tail = result.then(() => {}, () => {});
      return result;
    }
  };
  const service = new PaymentGatewayService(new ConfigService({
    PAYMENT_GATEWAY_ENABLED: "true", PAYMENT_GATEWAY_PROVIDER: "asaas", ASAAS_ENV: "sandbox",
    ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com", ASAAS_API_KEY: "synthetic-key",
    ASAAS_WEBHOOK_TOKEN: "synthetic-webhook-token"
  }), prisma as never);
  return { service, transaction, eventCount: () => events };
}

describe("security hardening: webhook", () => {
  it("unknown provider payment never calls the provider or changes data", async () => {
    const service = new PaymentGatewayService(new ConfigService({
      PAYMENT_GATEWAY_ENABLED: "true", PAYMENT_GATEWAY_PROVIDER: "asaas", ASAAS_ENV: "sandbox",
      ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com", ASAAS_API_KEY: "synthetic-key", ASAAS_WEBHOOK_TOKEN: "synthetic-webhook-token"
    }), { paymentTransaction: { findFirst: async () => null } } as never);
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("External call forbidden in this test"); }) as typeof fetch;
    try {
      const result = await service.handleWebhook({ id: "unknown-event", event: "PAYMENT_RECEIVED", payment: { id: "unknown-payment" } }, { "asaas-access-token": "synthetic-webhook-token" });
      assert.equal(result.rawStatus, "asaas_unknown_payment");
    } finally { globalThis.fetch = original; }
  });

  it("parallel duplicate webhook creates one business event", async () => {
    const { service, eventCount, transaction } = webhookHarness();
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: "pay-qa", status: "RECEIVED", value: 50, billingType: "PIX", externalReference: "order-qa"
    }), { status: 200 })) as typeof fetch;
    try {
      const payload = { id: "event-qa", event: "PAYMENT_RECEIVED", payment: { id: "pay-qa" } };
      const headers = { "asaas-access-token": "synthetic-webhook-token" };
      await Promise.all([service.handleWebhook(payload, headers), service.handleWebhook(payload, headers)]);
      assert.equal(eventCount(), 1);
      assert.equal(transaction.order.paymentStatus, "PAID");
      await service.handleWebhook(payload, headers);
      assert.equal(eventCount(), 1);
    } finally { globalThis.fetch = original; }
  });

  it("stale provider status cannot undo PAID or repeat its business event", async () => {
    const { service, eventCount, transaction } = webhookHarness();
    const original = globalThis.fetch;
    let status = "RECEIVED";
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: "pay-qa", status, value: 50, billingType: "PIX", externalReference: "order-qa"
    }), { status: 200 })) as typeof fetch;
    try {
      const headers = { "asaas-access-token": "synthetic-webhook-token" };
      await service.handleWebhook({ id: "event-paid", event: "PAYMENT_RECEIVED", payment: { id: "pay-qa" } }, headers);
      status = "PENDING";
      await service.handleWebhook({ id: "event-stale", event: "PAYMENT_CREATED", payment: { id: "pay-qa" } }, headers);
      assert.equal(transaction.status, "PAID");
      assert.equal(transaction.order.paymentStatus, "PAID");
      assert.equal(eventCount(), 1);
    } finally { globalThis.fetch = original; }
  });
});

function socketHarness() {
  const state = { revoked: false, active: true, status: "ACTIVE", role: UserRole.STORE_ADMIN, linked: true, storeActive: true };
  const delivered: string[] = [];
  let disconnected = false;
  const socket = {
    id: "socket-qa", data: {} as Record<string, unknown>, rooms: new Set(["socket-qa"]),
    handshake: { auth: { token: "synthetic", storeId: "store-b", role: UserRole.PLATFORM_ADMIN }, headers: {} },
    join: async (room: string) => { socket.rooms.add(room); },
    leave: async (room: string) => { socket.rooms.delete(room); },
    disconnect: () => { disconnected = true; },
    emit: (event: string) => { delivered.push(event); }
  };
  const gateway = new OrdersRealtimeGateway({
    verifyAsync: async () => ({ sub: "user-a", sid: "session-a", exp: Math.floor(Date.now() / 1000) + 60 })
  } as never, {
    user: { findUnique: async () => ({ id: "user-a", email: "qa@example.invalid", active: state.active, status: state.status, role: state.role }) },
    authSession: { findFirst: async () => state.revoked ? null : { id: "session-a" } },
    store: { findUnique: async () => ({ id: "store-a", active: state.storeActive, status: "ACTIVE" }) },
    storeCourierLink: { findMany: async () => state.linked ? [{ storeId: "store-a" }] : [] }
  } as never);
  gateway.server = { in: () => ({ fetchSockets: async () => [socket] }) } as never;
  return { gateway, socket, state, delivered, disconnected: () => disconnected };
}

describe("security hardening: realtime", () => {
  it("handshake rejects a revoked session", async () => {
    const h = socketHarness(); h.state.revoked = true;
    await h.gateway.handleConnection(h.socket as unknown as Socket);
    assert.ok(h.disconnected());
    assert.ok(!h.socket.rooms.has("store:store-a"));
  });

  for (const change of ["revoked", "inactive", "suspended", "role", "store", "expired", "spoof"] as const) {
    it(`rechecks before sending: ${change}`, async () => {
      const h = socketHarness();
      await h.gateway.handleConnection(h.socket as unknown as Socket);
      assert.ok(h.socket.rooms.has("store:store-a"));
      assert.ok(!h.socket.rooms.has("store:store-b"));
      await h.gateway.emitAuthorized("orders.created", {}, ["store:store-a"]);
      assert.equal(h.delivered.length, 1);
      if (change === "revoked") h.state.revoked = true;
      if (change === "inactive") h.state.active = false;
      if (change === "suspended") h.state.status = "SUSPENDED";
      if (change === "role") h.state.role = UserRole.CLIENT;
      if (change === "store") h.state.storeActive = false;
      if (change === "expired") (h.socket.data.accessSession as { exp: number }).exp = 1;
      await h.gateway.emitAuthorized("orders.created", {}, [change === "spoof" ? "store:store-b" : "store:store-a"]);
      assert.equal(h.delivered.length, 1);
      if (change !== "spoof") assert.ok(h.disconnected());
    });
  }

  it("courier loses available room after store link removal", async () => {
    const h = socketHarness(); h.state.role = UserRole.COURIER;
    await h.gateway.handleConnection(h.socket as unknown as Socket);
    assert.ok(h.socket.rooms.has("orders:available:store-a"));
    h.state.linked = false;
    await h.gateway.emitAuthorized("orders.created", {}, ["orders:available:store-a"]);
    assert.equal(h.delivered.length, 0);
    assert.ok(!h.socket.rooms.has("orders:available:store-a"));
  });
});

describe("security hardening: logging", () => {
  it("redacts nested params, error stacks, Sentry spans and credential queries", () => {
    const capability = "synthetic_tracking-capability_1234567890";
    const url = `https://example.invalid/api/storefront/orders/${capability}?accessToken=synthetic-secret`;
    const sanitized = sanitizeLogData({
      request: { url, params: { publicTrackingToken: capability } },
      exception: { values: [{ value: `Failed GET ${url}`, stack: url }] },
      spans: [{ description: `GET ${url}` }],
      breadcrumb: { data: { trackingToken: capability, url } },
      requestId: "safe-request-id"
    });
    assert.ok(!JSON.stringify(sanitized).includes(capability));
    assert.ok(!JSON.stringify(sanitized).includes("synthetic-secret"));
    assert.equal(sanitized.requestId, "safe-request-id");
    assert.equal(sanitizeRequestPath(`/api/storefront/orders/${capability}?q=1`), "/api/storefront/orders/[REDACTED]");
  });

  it("request path does not expose a storefront tracking capability", () => {
    const capability = "synthetic_tracking-capability_1234567890";
    const entries: string[] = [];
    Logger.overrideLogger({ log: value => entries.push(String(value)), warn() {}, error() {} });
    try {
      let finish = () => {};
      requestLoggingMiddleware({ method: "GET", originalUrl: `/api/storefront/orders/${capability}?token=synthetic`, headers: {} }, {
        statusCode: 200, setHeader() {}, on: (_event, listener) => { finish = listener; }
      }, () => {});
      finish();
      assert.ok(entries.length);
      assert.ok(entries.every(entry => !entry.includes(capability) && !entry.includes("token=synthetic")));
    } finally { Logger.overrideLogger(["log", "warn", "error"]); }
  });
});

describe("security hardening: upload validation without storage writes", () => {
  for (const mimetype of ["image/svg+xml", "text/html", "image/png"]) {
    it(`rejects disallowed MIME or forged signature: ${mimetype}`, async () => {
      const file = { originalname: "synthetic.png", mimetype, buffer: Buffer.from("not-an-image"), size: 12 };
      // Force local drivers and assert the validation error, not a missing S3 configuration.
      const original = process.env.PAYMENT_PROOF_STORAGE_DRIVER;
      const originalImage = process.env.IMAGE_STORAGE_DRIVER;
      process.env.PAYMENT_PROOF_STORAGE_DRIVER = "local";
      process.env.IMAGE_STORAGE_DRIVER = "local";
      try {
        await assert.rejects(() => new ImageStorageService().saveImage("synthetic", file), BadRequestException);
        await assert.rejects(() => new PaymentProofStorageService().saveProofFile("synthetic", file), BadRequestException);
      }
      finally {
        if (original === undefined) delete process.env.PAYMENT_PROOF_STORAGE_DRIVER;
        else process.env.PAYMENT_PROOF_STORAGE_DRIVER = original;
        if (originalImage === undefined) delete process.env.IMAGE_STORAGE_DRIVER;
        else process.env.IMAGE_STORAGE_DRIVER = originalImage;
      }
    });
  }
});
