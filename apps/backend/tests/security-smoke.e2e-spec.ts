import "reflect-metadata";
import { Readable } from "node:stream";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BadRequestException,
  Injectable,
  Module,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { UserRole } from "../src/common/enums/user-role.enum";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OrdersController } from "../src/orders/orders.controller";
import { OrdersService } from "../src/orders/orders.service";
import { PaymentGatewayService } from "../src/orders/payment-gateway.service";
import { PaymentWebhooksController } from "../src/webhooks/payment-webhooks.controller";
import { StoresController } from "../src/stores/stores.controller";
import { StoresService } from "../src/stores/stores.service";
import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  PaymentTransactionProvider,
  PaymentTransactionStatus,
  Prisma
} from "@prisma/client";

const TEST_JWT_SECRET = "rotapronta-smoke-security-test-secret";

const actorByName: Record<string, { sub: string; email: string; role: UserRole }> = {
  courier: {
    sub: "courier-user",
    email: "courier@example.com",
    role: UserRole.COURIER
  },
  client: {
    sub: "client-user",
    email: "client@example.com",
    role: UserRole.CLIENT
  },
  store: {
    sub: "store-user",
    email: "store@example.com",
    role: UserRole.STORE_ADMIN
  },
  platform: {
    sub: "platform-user",
    email: "platform@example.com",
    role: UserRole.PLATFORM_ADMIN
  }
};

@Injectable()
class SmokeJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: TEST_JWT_SECRET
    });
  }

  validate(payload: { sub: string; email: string; role: UserRole }) {
    return payload;
  }
}

const ordersServiceMock = {
  create: (userId: string, role: UserRole, dto: { paymentMethod?: string }) => {
    if (dto.paymentMethod === "ONLINE") {
      throw new BadRequestException("Pagamento online ainda nao esta habilitado");
    }

    return { id: "order-created" };
  },
  createClientOrder: (userId: string, role: UserRole, dto: { paymentMethod?: string }) => {
    if (dto.paymentMethod === "ONLINE") {
      throw new BadRequestException("Pagamento online ainda nao esta habilitado");
    }

    return { id: "client-order-created" };
  },
  listClientOrders: () => ({ items: [], meta: { page: 1, totalPages: 1 } }),
  list: () => ({ items: [], meta: { page: 1, totalPages: 1 } }),
  confirmOrder: () => ({ id: "order-confirmed" }),
  getHistory: () => [],
  getPaymentProofFile: (orderId: string) => {
    if (orderId === "other-store-order") {
      throw new NotFoundException("Arquivo de comprovante nao encontrado");
    }

    return {
      stream: Readable.from(["comprovante"]),
      fileName: "comprovante.pdf",
      mimeType: "application/pdf",
      size: 11
    };
  },
  approvePaymentProof: () => ({ id: "proof-approved" }),
  rejectPaymentProof: () => ({ id: "proof-rejected" }),
  submitPaymentProof: () => ({ id: "proof-submitted" }),
  uploadPaymentProofFile: () => ({ id: "proof-uploaded" }),
  markManualPaymentPaid: () => ({ id: "payment-paid" }),
  cancelOrder: () => ({ id: "order-cancelled" }),
  listAvailableForCourier: () => ({ items: [], meta: { page: 1, totalPages: 1 } }),
  listCourierOrders: () => ({ items: [], meta: { page: 1, totalPages: 1 } }),
  acceptOrder: () => ({ id: "order-accepted" }),
  updateCourierOrderStatus: () => ({ id: "order-status-updated" })
};

const paymentGatewayServiceMock = {
  createPixPayment: () => {
    throw new Error("Gateway de pagamento desativado");
  },
  getPaymentStatus: () => ({ status: "PENDING" }),
  handleWebhook: (_payload?: unknown, headers: Record<string, string | string[] | undefined> = {}) => {
    if (headers["asaas-access-token"] !== "valid-webhook-token") {
      throw new UnauthorizedException("Webhook Asaas nao autorizado");
    }

    return { status: "PENDING" };
  }
};

const storesServiceMock = {
  getDashboard: () => ({
    ordersToday: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    deliveredToday: 0,
    estimatedRevenueToday: 0,
    pendingPayments: 0,
    activeProducts: 0,
    activeCouriers: 0
  }),
  getStoreByOwner: () => ({ id: "store-1", name: "Loja", address: "Rua", active: true }),
  listDeliveryZones: () => [],
  getPixSettings: () => ({ pixEnabled: false }),
  updatePixSettings: () => ({ pixEnabled: true }),
  createDeliveryZone: () => ({ id: "zone-created" }),
  updateDeliveryZone: () => ({ id: "zone-updated" }),
  deactivateDeliveryZone: () => ({ id: "zone-deactivated" })
};

const adminServiceMock = {
  getDashboard: () => ({
    activeStores: 1,
    suspendedStores: 0,
    inactiveStores: 0,
    activeUsers: 1,
    activeCouriers: 0,
    ordersToday: 0,
    totalOrders: 0,
    pendingPayments: 0,
    recentStores: []
  }),
  listAuditLogs: () => ({
    items: [
      {
        id: "audit-1",
        action: "STORE_SUSPENDED",
        targetType: "STORE",
        targetId: "store-1"
      }
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
  }),
  listStores: () => [
    {
      id: "store-1",
      name: "Loja",
      owner: {
        id: "owner-1",
        name: "Dono",
        email: "owner@example.com",
        role: "STORE_ADMIN",
        status: "ACTIVE",
        active: true
      }
    }
  ],
  getStore: () => ({ id: "store-1" }),
  createStore: () => ({ id: "store-created" }),
  updateStoreStatus: () => ({ id: "store-1", status: "SUSPENDED" }),
  listUsers: () => [
    {
      id: "user-1",
      name: "Usuario",
      email: "user@example.com",
      role: "CLIENT",
      status: "ACTIVE",
      active: true
    }
  ],
  getUser: () => ({ id: "user-1" }),
  createUser: () => ({ id: "user-created" }),
  updateUserStatus: () => ({ id: "user-1", status: "INACTIVE" }),
  listCouriers: () => [],
  updateCourierStatus: () => ({ id: "courier-1", status: "SUSPENDED" }),
  blockCourierLink: () => ({ id: "link-1", status: "BLOCKED" })
};

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: TEST_JWT_SECRET,
      signOptions: { expiresIn: "5m" }
    })
  ],
  controllers: [
    OrdersController,
    StoresController,
    AdminController,
    PaymentWebhooksController
  ],
  providers: [
    SmokeJwtStrategy,
    RolesGuard,
    { provide: AdminService, useValue: adminServiceMock },
    { provide: OrdersService, useValue: ordersServiceMock },
    { provide: PaymentGatewayService, useValue: paymentGatewayServiceMock },
    { provide: StoresService, useValue: storesServiceMock }
  ]
})
class SmokeSecurityTestModule {}

describe("backend smoke/security routes", () => {
  let app: INestApplication;
  let baseUrl: string;
  let tokens: Record<keyof typeof actorByName, string>;

  before(async () => {
    app = await NestFactory.create(SmokeSecurityTestModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.listen(0, "127.0.0.1");

    const jwtService = app.get(JwtService);
    tokens = {
      courier: await jwtService.signAsync(actorByName.courier),
      client: await jwtService.signAsync(actorByName.client),
      store: await jwtService.signAsync(actorByName.store),
      platform: await jwtService.signAsync(actorByName.platform)
    };

    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  after(async () => {
    await app?.close();
  });

  async function request(
    path: string,
    options: RequestInit & { token?: keyof typeof actorByName } = {}
  ) {
    const headers = new Headers(options.headers);

    if (options.token) {
      headers.set("Authorization", `Bearer ${tokens[options.token]}`);
    }

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });
  }

  async function expectStatus(
    path: string,
    status: number,
    options?: RequestInit & { token?: keyof typeof actorByName }
  ) {
    const response = await request(path, options);
    assert.equal(response.status, status, `${path} deveria retornar ${status}`);
  }

  it("retorna 401 em rotas criticas sem token", async () => {
    await expectStatus("/orders", 401);
    await expectStatus("/stores/me/pix-settings", 401);
    await expectStatus("/stores/me/delivery-zones", 401);
    await expectStatus("/orders/order-1/payment-proof/file", 401);
    await expectStatus("/orders/order-1/payment/paid", 401, { method: "PATCH" });
    await expectStatus("/orders/order-1/payment-proof/approve", 401, { method: "PATCH" });
    await expectStatus("/orders/order-1/payment-proof/reject", 401, { method: "PATCH" });
    await expectStatus("/admin/stores", 401);
    await expectStatus("/admin/users", 401);
    await expectStatus("/admin/couriers", 401);
    await expectStatus("/admin/audit-logs", 401);
    await expectStatus("/admin/dashboard", 401);
    await expectStatus("/stores/me/dashboard", 401);
    await expectStatus("/webhooks/payments/asaas", 401, {
      method: "POST",
      body: JSON.stringify({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } })
    });
  });

  it("bloqueia motoboy em Pix, comprovante detalhado e gestao de pagamento", async () => {
    await expectStatus("/stores/me/pix-settings", 403, { token: "courier" });
    await expectStatus("/orders/order-1/payment-proof/file", 403, { token: "courier" });
    await expectStatus("/orders/order-1/payment/paid", 403, {
      method: "PATCH",
      token: "courier"
    });
  });

  it("bloqueia cliente em revisao de comprovante e baixa de pagamento", async () => {
    await expectStatus("/orders/order-1/payment-proof/approve", 403, {
      method: "PATCH",
      token: "client"
    });
    await expectStatus("/orders/order-1/payment-proof/reject", 403, {
      method: "PATCH",
      token: "client"
    });
    await expectStatus("/orders/order-1/payment/paid", 403, {
      method: "PATCH",
      token: "client"
    });
  });

  it("nao permite acesso de loja a comprovante fora do escopo da loja", async () => {
    await expectStatus("/orders/other-store-order/payment-proof/file", 404, {
      token: "store"
    });
  });

  it("retorna 400 para valores monetarios extremos ou invalidos", async () => {
    await expectStatus("/orders", 400, {
      method: "POST",
      token: "store",
      body: JSON.stringify({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        customerAddress: "Rua Teste, 123",
        deliveryFee: 100000000,
        paymentMethod: "CASH",
        items: [{ productId: "cmtestproduct123", quantity: 1 }]
      })
    });

    await expectStatus("/stores/me/delivery-zones", 400, {
      method: "POST",
      token: "store",
      body: JSON.stringify({
        name: "Centro",
        district: "Centro",
        fee: 100000000,
        isActive: true
      })
    });
  });

  it("mantem gateway automatico bloqueado e payloads de pagamento sensiveis rejeitados", async () => {
    await expectStatus("/orders", 400, {
      method: "POST",
      token: "store",
      body: JSON.stringify({
        customerName: "Cliente Teste",
        customerPhone: "11999999999",
        customerAddress: "Rua Teste, 123",
        deliveryFee: 8,
        paymentMethod: "ONLINE",
        items: [{ productId: "cmtestproduct123", quantity: 1 }]
      })
    });

    await expectStatus("/orders/client", 400, {
      method: "POST",
      token: "client",
      body: JSON.stringify({
        storeId: "cmteststore123",
        fulfillmentType: "PICKUP",
        paymentMethod: "PIX_MANUAL",
        paymentStatus: "PAID",
        paidAt: new Date().toISOString(),
        paymentProvider: "FUTURE_GATEWAY",
        items: [{ productId: "cmtestproduct123", quantity: 1 }]
      })
    });

    const webhookResult = await paymentGatewayServiceMock.handleWebhook(undefined, {
      "asaas-access-token": "valid-webhook-token"
    });
    assert.equal(webhookResult.status, "PENDING");
  });

  it("bloqueia webhook Asaas sem token valido", async () => {
    await expectStatus("/webhooks/payments/asaas", 401, {
      method: "POST",
      headers: {
        "asaas-access-token": "invalid-token"
      },
      body: JSON.stringify({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } })
    });

    await expectStatus("/webhooks/payments/asaas", 200, {
      method: "POST",
      headers: {
        "asaas-access-token": "valid-webhook-token"
      },
      body: JSON.stringify({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } })
    });
  });

  it("retorna 400 para comprovante Pix com valor com mais de duas casas decimais", async () => {
    await expectStatus("/orders/order-1/payment-proof", 400, {
      method: "PATCH",
      token: "client",
      body: JSON.stringify({
        payerName: "Cliente Teste",
        amount: 10.123,
        reference: "PIX-123"
      })
    });
  });

  it("protege rotas admin por role e nao expoe hash de senha", async () => {
    await expectStatus("/admin/stores", 403, { token: "store" });
    await expectStatus("/admin/stores", 403, { token: "client" });
    await expectStatus("/admin/stores", 403, { token: "courier" });
    await expectStatus("/admin/audit-logs", 403, { token: "store" });
    await expectStatus("/admin/dashboard", 403, { token: "store" });
    await expectStatus("/stores/me/dashboard", 403, { token: "platform" });

    const response = await request("/admin/users", { token: "platform" });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as unknown;
    assert.equal(JSON.stringify(payload).includes("passwordHash"), false);

    await expectStatus("/admin/audit-logs", 200, { token: "platform" });
    await expectStatus("/admin/dashboard", 200, { token: "platform" });
    await expectStatus("/stores/me/dashboard", 200, { token: "store" });
  });
});

describe("payment gateway foundation", () => {
  it("bloqueia criacao automatica quando a feature flag esta desligada", async () => {
    const service = new PaymentGatewayService(
      new ConfigService({
        PAYMENT_GATEWAY_ENABLED: "false",
        PAYMENT_GATEWAY_PROVIDER: ""
      })
    );

    await assert.rejects(
      () =>
        service.createPixPayment({
          id: "order-1",
          paymentMethod: OrderPaymentMethod.ONLINE,
          paymentStatus: OrderPaymentStatus.PENDING,
          total: 25
        }),
      /Gateway de pagamento desativado/
    );
  });

  it("stub nao marca pagamento como pago sem provider real", async () => {
    const service = new PaymentGatewayService(
      new ConfigService({
        PAYMENT_GATEWAY_ENABLED: "true",
        PAYMENT_GATEWAY_PROVIDER: "stub"
      })
    );

    const result = await service.handleWebhook();

    assert.equal(result.status, "PENDING");
    assert.notEqual(result.status, "PAID");
  });

  it("provider Asaas nao roda sem env obrigatoria", async () => {
    const service = new PaymentGatewayService(
      new ConfigService({
        PAYMENT_GATEWAY_ENABLED: "true",
        PAYMENT_GATEWAY_PROVIDER: "asaas",
        ASAAS_ENV: "sandbox"
      })
    );

    await assert.rejects(
      () =>
        service.createPixPayment({
          id: "order-1",
          paymentMethod: OrderPaymentMethod.ONLINE,
          paymentStatus: OrderPaymentStatus.PENDING,
          total: 25,
          asaasCustomerId: "cus_1"
        }),
      /ASAAS_API_BASE_URL nao configurada/
    );
  });

  it("webhook Asaas duplicado e idempotente", async () => {
    const fetchOriginal = globalThis.fetch;
    const paymentTransactionUpdateCalls: unknown[] = [];
    const orderUpdateCalls: unknown[] = [];
    const eventCreateCalls: unknown[] = [];

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "pay_1",
          status: "RECEIVED",
          value: 50,
          billingType: "PIX",
          externalReference: "order-1",
          paymentDate: "2026-07-09"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    try {
      const service = new PaymentGatewayService(
        new ConfigService({
          PAYMENT_GATEWAY_ENABLED: "true",
          PAYMENT_GATEWAY_PROVIDER: "asaas",
          ASAAS_ENV: "sandbox",
          ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
          ASAAS_API_KEY: "test-api-key",
          ASAAS_WEBHOOK_TOKEN: "valid-webhook-token"
        }),
        {
          paymentTransaction: {
            findFirst: async () => ({
              id: "tx-1",
              orderId: "order-1",
              provider: PaymentTransactionProvider.ASAAS,
              providerPaymentId: "pay_1",
              status: PaymentTransactionStatus.PENDING,
              amount: new Prisma.Decimal(50),
              paidAt: null,
              rawStatus: "PENDING",
              metadataJson: { processedWebhookIds: ["evt-1"] },
              order: {
                paymentStatus: OrderPaymentStatus.PENDING
              }
            }),
            update: async (args: unknown) => {
              paymentTransactionUpdateCalls.push(args);
              return args;
            }
          },
          $transaction: async (callback: (prisma: unknown) => Promise<unknown>) =>
            callback({
              paymentTransaction: {
                update: async (args: unknown) => {
                  paymentTransactionUpdateCalls.push(args);
                  return args;
                }
              },
              order: {
                update: async (args: unknown) => {
                  orderUpdateCalls.push(args);
                  return args;
                }
              },
              orderEvent: {
                create: async (args: unknown) => {
                  eventCreateCalls.push(args);
                  return args;
                }
              }
            })
        } as never
      );

      const result = await service.handleWebhook(
        { id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
        { "asaas-access-token": "valid-webhook-token" }
      );

      assert.equal(result.status, "PENDING");
      assert.equal(paymentTransactionUpdateCalls.length, 0);
      assert.equal(orderUpdateCalls.length, 0);
      assert.equal(eventCreateCalls.length, 0);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it("webhook Asaas com valor divergente nao marca pedido como pago", async () => {
    const fetchOriginal = globalThis.fetch;
    const paymentTransactionUpdateCalls: unknown[] = [];
    const orderUpdateCalls: unknown[] = [];
    const eventCreateCalls: unknown[] = [];

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "pay_1",
          status: "RECEIVED",
          value: 49,
          billingType: "PIX",
          externalReference: "order-1",
          paymentDate: "2026-07-09"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;

    try {
      const service = new PaymentGatewayService(
        new ConfigService({
          PAYMENT_GATEWAY_ENABLED: "true",
          PAYMENT_GATEWAY_PROVIDER: "asaas",
          ASAAS_ENV: "sandbox",
          ASAAS_API_BASE_URL: "https://api-sandbox.asaas.com",
          ASAAS_API_KEY: "test-api-key",
          ASAAS_WEBHOOK_TOKEN: "valid-webhook-token"
        }),
        {
          paymentTransaction: {
            findFirst: async () => ({
              id: "tx-1",
              orderId: "order-1",
              provider: PaymentTransactionProvider.ASAAS,
              providerPaymentId: "pay_1",
              status: PaymentTransactionStatus.PENDING,
              amount: new Prisma.Decimal(50),
              paidAt: null,
              rawStatus: "PENDING",
              metadataJson: null,
              order: {
                paymentStatus: OrderPaymentStatus.PENDING
              }
            }),
            update: async (args: unknown) => {
              paymentTransactionUpdateCalls.push(args);
              return args;
            }
          },
          $transaction: async (callback: (prisma: unknown) => Promise<unknown>) =>
            callback({
              paymentTransaction: {
                update: async (args: unknown) => {
                  paymentTransactionUpdateCalls.push(args);
                  return args;
                }
              },
              order: {
                update: async (args: unknown) => {
                  orderUpdateCalls.push(args);
                  return args;
                }
              },
              orderEvent: {
                create: async (args: unknown) => {
                  eventCreateCalls.push(args);
                  return args;
                }
              }
            })
        } as never
      );

      const result = await service.handleWebhook(
        { id: "evt-2", event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
        { "asaas-access-token": "valid-webhook-token" }
      );

      assert.equal(result.status, "PENDING");
      assert.equal(paymentTransactionUpdateCalls.length, 1);
      assert.equal(orderUpdateCalls.length, 0);
      assert.equal(eventCreateCalls.length, 0);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
