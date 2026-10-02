import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/auth/auth.service";
import { PaymentGatewayService } from "../src/orders/payment-gateway.service";

describe("security concurrency on isolated local PostgreSQL", () => {
  let prisma: PrismaService;
  let userId: string;
  let storeId: string;
  const orderIds: string[] = [];
  const prefix = `qa-security-${randomUUID()}`;

  before(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Somente PostgreSQL local permitido");
    assert.match(`${url.pathname} ${url.searchParams.get("schema") ?? ""}`, /e2e|test/i, "Banco/schema precisa ser de teste");
    assert.notEqual(url.searchParams.get("schema"), "public", "Schema public nao permitido");
    prisma = new PrismaService();
    await prisma.$connect();
    const user = await prisma.user.create({ data: {
      name: prefix, email: `${prefix}@example.invalid`, phone: "11900000000",
      passwordHash: await bcrypt.hash("SyntheticLocalPasswordOnly", 4), role: "STORE_ADMIN"
    } });
    userId = user.id;
    const store = await prisma.store.create({ data: { name: prefix, address: "Endereco sintetico", ownerUserId: user.id } });
    storeId = store.id;
  });

  after(async () => {
    if (!prisma) return;
    try {
      if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds }, storeId } });
      if (storeId) await prisma.store.delete({ where: { id: storeId } });
      if (userId) {
        await prisma.authAuditEvent.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
      }
    } finally { await prisma.$disconnect(); }
  });

  it("same refresh is consumed once by concurrent service calls", async () => {
    const id = randomUUID();
    const refreshToken = `${id}.${randomUUID()}`;
    await prisma.authSession.create({ data: {
      id, userId, refreshTokenHash: await bcrypt.hash(refreshToken, 4), expiresAt: new Date(Date.now() + 60_000)
    } });
    const service = new AuthService(prisma, new JwtService({ secret: "synthetic-test-only-access-secret" }), new ConfigService(), {} as never);
    const results = await Promise.allSettled([service.refresh({ refreshToken }), service.refresh({ refreshToken })]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { id } })).revokedAt, null);
  });

  it("parallel webhook creates one event; replay and stale provider status do not undo PAID", async () => {
    const order = await prisma.order.create({ data: {
      storeId, customerName: prefix, customerPhone: "11900000000", customerAddress: "Endereco sintetico",
      subtotal: 50, deliveryFee: 0, total: 50, paymentMethod: "ONLINE"
    } });
    orderIds.push(order.id);
    const providerId = `pay-${randomUUID()}`;
    await prisma.paymentTransaction.create({ data: { orderId: order.id, provider: "ASAAS", providerPaymentId: providerId, amount: 50 } });
    const service = new PaymentGatewayService(new ConfigService({
      PAYMENT_GATEWAY_ENABLED: "true", PAYMENT_GATEWAY_PROVIDER: "asaas", ASAAS_ENV: "sandbox",
      ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com", ASAAS_API_KEY: "synthetic-key",
      ASAAS_WEBHOOK_TOKEN: "synthetic-webhook-token"
    }), prisma);
    const originalFetch = globalThis.fetch;
    let status = "RECEIVED";
    // No external provider request: only the database and service logic are real.
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: providerId, status, value: 50, billingType: "PIX", externalReference: order.id
    }), { status: 200 })) as typeof fetch;
    try {
      const payload = { id: `evt-${randomUUID()}`, event: "PAYMENT_RECEIVED", payment: { id: providerId } };
      const headers = { "asaas-access-token": "synthetic-webhook-token" };
      await Promise.all([service.handleWebhook(payload, headers), service.handleWebhook(payload, headers)]);
      await service.handleWebhook(payload, headers);
      status = "PENDING";
      await service.handleWebhook({ ...payload, id: `evt-${randomUUID()}` }, headers);
      assert.equal(await prisma.orderEvent.count({ where: { orderId: order.id, type: "PAYMENT_PAID" } }), 1);
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, "PAID");
      assert.equal((await prisma.paymentTransaction.findFirstOrThrow({ where: { orderId: order.id } })).status, "PAID");
    } finally { globalThis.fetch = originalFetch; }
  });
});
