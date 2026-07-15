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
import { CashRegistersController } from "../src/cash-registers/cash-registers.controller";
import { CashRegistersService } from "../src/cash-registers/cash-registers.service";
import { UserRole } from "../src/common/enums/user-role.enum";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OrdersController } from "../src/orders/orders.controller";
import { OrdersService } from "../src/orders/orders.service";
import { NotificationsController } from "../src/notifications/notifications.controller";
import { NotificationsService } from "../src/notifications/notifications.service";
import { PaymentGatewayService } from "../src/orders/payment-gateway.service";
import { ReportsController } from "../src/reports/reports.controller";
import { ReportsService } from "../src/reports/reports.service";
import { SalesController } from "../src/sales/sales.controller";
import { SalesService } from "../src/sales/sales.service";
import { PaymentWebhooksController } from "../src/webhooks/payment-webhooks.controller";
import { StoresController } from "../src/stores/stores.controller";
import { StoresService } from "../src/stores/stores.service";
import { StockController } from "../src/stock/stock.controller";
import { StockService } from "../src/stock/stock.service";
import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  PaymentTransactionProvider,
  PaymentTransactionStatus,
  Prisma,
  StockMovementType
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
  getClientPaymentOptions: () => ({
    methods: ["CASH", "CARD_ON_DELIVERY", "PIX_MANUAL"],
    automaticPixEnabled: false
  }),
  getPaymentTransaction: () => ({
    orderId: "order-1",
    paymentMethod: "ONLINE",
    paymentStatus: "PENDING",
    automaticPixPayment: {
      status: "PENDING",
      amount: 25,
      currency: "BRL",
      qrCodeText: "pix-copia-e-cola",
      qrCodeImageUrl: "data:image/png;base64,abc",
      expiresAt: new Date().toISOString()
    }
  }),
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
  getReadiness: () => ({
    storeId: "store-1",
    ready: false,
    percentage: 50,
    overallPercentage: 50,
    completedRequiredItems: 1,
    totalRequiredItems: 2,
    completedItems: 1,
    totalItems: 2,
    items: []
  }),
  getStoreByOwner: () => ({ id: "store-1", name: "Loja", address: "Rua", active: true }),
  listDeliveryZones: () => [],
  getPixSettings: () => ({ pixEnabled: false }),
  updatePixSettings: () => ({ pixEnabled: true }),
  createDeliveryZone: () => ({ id: "zone-created" }),
  updateDeliveryZone: () => ({ id: "zone-updated" }),
  deactivateDeliveryZone: () => ({ id: "zone-deactivated" })
};

const salesServiceMock = {
  create: () => ({ id: "sale-created" }),
  list: () => ({ items: [], meta: { page: 1, totalPages: 1 } }),
  findOne: () => ({ id: "sale-1" }),
  addItem: (_userId: string, _role: UserRole, _saleId: string, dto: { quantity: number }) => {
    if (dto.quantity <= 0) {
      throw new BadRequestException("Quantidade invalida");
    }

    return { id: "sale-1" };
  },
  updateItem: () => ({ id: "sale-1" }),
  removeItem: () => ({ id: "sale-1" }),
  update: () => ({ id: "sale-1" }),
  complete: (
    _userId: string,
    _role: UserRole,
    _saleId: string,
    dto: { payments: Array<{ method: string; amount: number }> }
  ) => {
    if (dto.payments.some((payment) => payment.method === "PIX_AUTOMATIC")) {
      throw new BadRequestException("Pix automatico para PDV ainda nao esta habilitado");
    }

    return { id: "sale-1", status: "COMPLETED" };
  },
  cancel: () => ({ id: "sale-1", status: "CANCELLED" }),
  receipt: () => ({
    notice: "DOCUMENTO SEM VALOR FISCAL",
    sale: { id: "sale-1" }
  })
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

const cashRegistersServiceMock = {
  create: () => ({ id: "cash-register-created" }),
  list: () => [],
  update: () => ({ id: "cash-register-1" }),
  open: () => ({ id: "cash-session-open" }),
  getCurrentSession: () => null,
  listSessions: () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
  findSession: () => ({ id: "cash-session-1" }),
  cashIn: () => ({ id: "cash-session-1" }),
  cashOut: () => ({ id: "cash-session-1" }),
  close: () => ({ id: "cash-session-1" }),
  report: () => ({ session: { id: "cash-session-1" }, report: {} })
};

const stockServiceMock = {
  listProducts: () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }),
  getProduct: () => ({ id: "product-1" }),
  updateSettings: () => ({ id: "product-1", stockControlEnabled: true }),
  createMovement: () => ({ id: "movement-1" }),
  listMovements: () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }),
  getSummary: () => ({ controlledProducts: 0, availableProducts: 0, lowStockProducts: 0, outOfStockProducts: 0 })
};

const notificationsServiceMock = {
  listDevices: () => [],
  registerDevice: () => ({ id: "device-1", platform: "android", appProfile: "mobile" }),
  removeDevice: () => ({ message: "Dispositivo removido das notificacoes." }),
  removeAllDevices: () => ({ message: "Dispositivos removidos das notificacoes." })
};

const reportsServiceMock = {
  overview: (_userId: string, _role: UserRole, query: { period?: string; dateFrom?: string; dateTo?: string }) => {
    if (query.period === "custom" && (!query.dateFrom || !query.dateTo || query.dateFrom > query.dateTo)) {
      throw new BadRequestException("Periodo personalizado invalido");
    }

    return {
      sales: {
        soldAmount: 10,
        paidAmount: 5,
        pendingAmount: 5,
        averageTicket: 10
      }
    };
  },
  sales: () => ({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 }),
  products: () => ({ items: [] }),
  payments: () => ({ items: [] }),
  cash: () => ({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 }),
  stock: () => ({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 }),
  salesCsv: () => ({
    fileName: "relatorio-vendas.csv",
    content: "\uFEFF\"Cliente\"\r\n\"'=2+2\""
  }),
  productsCsv: () => ({ fileName: "relatorio-produtos.csv", content: "\uFEFF\"Produto\"" }),
  cashCsv: () => ({ fileName: "relatorio-caixa.csv", content: "\uFEFF\"Caixa\"" }),
  stockCsv: () => ({ fileName: "relatorio-estoque.csv", content: "\uFEFF\"Estoque\"" })
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
    SalesController,
    CashRegistersController,
    StockController,
    StoresController,
    AdminController,
    ReportsController,
    NotificationsController,
    PaymentWebhooksController
  ],
  providers: [
    SmokeJwtStrategy,
    RolesGuard,
    { provide: AdminService, useValue: adminServiceMock },
    { provide: OrdersService, useValue: ordersServiceMock },
    { provide: SalesService, useValue: salesServiceMock },
    { provide: CashRegistersService, useValue: cashRegistersServiceMock },
    { provide: PaymentGatewayService, useValue: paymentGatewayServiceMock },
    { provide: ReportsService, useValue: reportsServiceMock },
    { provide: StoresService, useValue: storesServiceMock },
    { provide: NotificationsService, useValue: notificationsServiceMock }
    ,{ provide: StockService, useValue: stockServiceMock }
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
    await expectStatus("/orders/client/payment-options", 401);
    await expectStatus("/orders/order-1/payment/transaction", 401);
    await expectStatus("/orders/order-1/payment/paid", 401, { method: "PATCH" });
    await expectStatus("/orders/order-1/payment-proof/approve", 401, { method: "PATCH" });
    await expectStatus("/orders/order-1/payment-proof/reject", 401, { method: "PATCH" });
    await expectStatus("/admin/stores", 401);
    await expectStatus("/admin/users", 401);
    await expectStatus("/admin/couriers", 401);
    await expectStatus("/admin/audit-logs", 401);
    await expectStatus("/admin/dashboard", 401);
    await expectStatus("/stores/me/dashboard", 401);
    await expectStatus("/stores/me/readiness", 401);
    await expectStatus("/sales", 401);
    await expectStatus("/sales/sale-1/items", 401, { method: "POST" });
    await expectStatus("/sales/sale-1/complete", 401, { method: "POST" });
    await expectStatus("/sales/sale-1/receipt", 401);
    await expectStatus("/cash-registers", 401);
    await expectStatus("/cash-registers/cash-1/open", 401, { method: "POST" });
    await expectStatus("/cash-register-sessions/session-1/cash-in", 401, { method: "POST" });
    await expectStatus("/cash-register-sessions/session-1/close", 401, { method: "POST" });
    await expectStatus("/stock/products", 401);
    await expectStatus("/stock/summary", 401);
    await expectStatus("/stock/products/product-1/settings", 401, { method: "PATCH" });
    await expectStatus("/stock/products/product-1/movements", 401, { method: "POST" });
    await expectStatus("/notifications/devices", 401);
    await expectStatus("/notifications/devices", 401, { method: "POST" });
    await expectStatus("/notifications/devices/device-1", 401, { method: "DELETE" });
    await expectStatus("/reports/overview", 401);
    await expectStatus("/reports/sales", 401);
    await expectStatus("/reports/products.csv", 401);
    await expectStatus("/webhooks/payments/asaas", 401, {
      method: "POST",
      body: JSON.stringify({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } })
    });
  });

  it("permite somente usuario autenticado registrar dispositivo proprio", async () => {
    await expectStatus("/notifications/devices", 200, { token: "client" });
    await expectStatus("/notifications/devices", 201, {
      method: "POST",
      token: "client",
      body: JSON.stringify({
        token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]",
        platform: "android"
      })
    });
    await expectStatus("/notifications/devices", 400, {
      method: "POST",
      token: "client",
      body: JSON.stringify({
        token: "curto",
        platform: "android"
      })
    });
    await expectStatus("/notifications/devices/device-1", 200, {
      method: "DELETE",
      token: "client"
    });
  });

  it("restringe gestao de estoque ao administrador da loja", async () => {
    for (const token of ["courier", "client", "platform"] as const) {
      await expectStatus("/stock/products", 403, { token });
      await expectStatus("/stock/summary", 403, { token });
      await expectStatus("/stock/products/product-1/movements", 403, {
        method: "POST",
        token,
        body: JSON.stringify({ type: "MANUAL_ENTRY", quantity: 1, reason: "Teste seguro" })
      });
    }
    await expectStatus("/stock/products", 200, { token: "store" });
  });

  it("bloqueia motoboy em Pix, comprovante detalhado e gestao de pagamento", async () => {
    await expectStatus("/stores/me/pix-settings", 403, { token: "courier" });
    await expectStatus("/orders/order-1/payment-proof/file", 403, { token: "courier" });
    await expectStatus("/orders/order-1/payment/paid", 403, {
      method: "PATCH",
      token: "courier"
    });
    await expectStatus("/orders/order-1/payment/transaction", 403, {
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

  it("bloqueia PDV para platform admin, cliente e motoboy", async () => {
    await expectStatus("/sales", 403, { token: "platform" });
    await expectStatus("/sales", 403, { token: "client" });
    await expectStatus("/sales", 403, { token: "courier" });
    await expectStatus("/cash-registers", 403, { token: "platform" });
    await expectStatus("/cash-registers", 403, { token: "client" });
    await expectStatus("/cash-registers", 403, { token: "courier" });
    await expectStatus("/sales/sale-1/complete", 403, {
      method: "POST",
      token: "client",
      body: JSON.stringify({ payments: [{ method: "CASH", amount: 10 }] })
    });
  });

  it("bloqueia relatorios para platform admin, cliente e motoboy", async () => {
    for (const token of ["platform", "client", "courier"] as const) {
      await expectStatus("/reports/overview", 403, { token });
      await expectStatus("/reports/sales", 403, { token });
      await expectStatus("/reports/sales.csv", 403, { token });
    }

    await expectStatus("/reports/overview", 200, { token: "store" });
  });

  it("protege checklist de configuracao inicial por role", async () => {
    await expectStatus("/stores/me/readiness", 403, { token: "platform" });
    await expectStatus("/stores/me/readiness", 403, { token: "client" });
    await expectStatus("/stores/me/readiness", 403, { token: "courier" });
    await expectStatus("/stores/me/readiness", 200, { token: "store" });

    const response = await request("/stores/me/readiness?storeId=store-b", { token: "store" });
    assert.equal(response.status, 200);
    const payload = await response.json() as { storeId?: string; pixKey?: string };
    assert.equal(payload.storeId, "store-1");
    assert.equal("pixKey" in payload, false);
  });

  it("valida filtros de relatorio e protege CSV contra formula", async () => {
    await expectStatus("/reports/overview?period=custom&dateFrom=2026-07-10&dateTo=2026-07-01", 400, {
      token: "store"
    });

    const response = await request("/reports/sales.csv", { token: "store" });
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.match(csv, /"'=2\+2"/);
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

    await expectStatus("/sales/sale-1/items", 400, {
      method: "POST",
      token: "store",
      body: JSON.stringify({
        productId: "cmtestproduct123",
        quantity: 0
      })
    });

    await expectStatus("/sales/sale-1/complete", 400, {
      method: "POST",
      token: "store",
      body: JSON.stringify({
        payments: [{ method: "PIX_AUTOMATIC", amount: 10 }]
      })
    });
  });

  it("retorna recibo de PDV com aviso sem valor fiscal", async () => {
    const response = await request("/sales/sale-1/receipt", {
      token: "store"
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.notice, "DOCUMENTO SEM VALOR FISCAL");
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

    const paymentOptionsResponse = await request("/orders/client/payment-options", {
      token: "client"
    });
    assert.equal(paymentOptionsResponse.status, 200);
    const paymentOptions = (await paymentOptionsResponse.json()) as {
      methods: string[];
      automaticPixEnabled: boolean;
    };
    assert.equal(paymentOptions.automaticPixEnabled, false);
    assert.equal(paymentOptions.methods.includes("ONLINE"), false);

    const transactionResponse = await request("/orders/order-1/payment/transaction", {
      token: "client"
    });
    assert.equal(transactionResponse.status, 200);
    const transactionPayload = await transactionResponse.json();
    assert.equal(JSON.stringify(transactionPayload).includes("providerPaymentId"), false);
    assert.equal(JSON.stringify(transactionPayload).includes("metadataJson"), false);
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

  it("webhook Asaas valida token antes da feature flag", async () => {
    const service = new PaymentGatewayService(
      new ConfigService({
        PAYMENT_GATEWAY_ENABLED: "false",
        PAYMENT_GATEWAY_PROVIDER: "",
        ASAAS_WEBHOOK_TOKEN: "valid-webhook-token"
      })
    );

    await assert.rejects(
      () =>
        service.handleWebhook(
          { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
          {},
          { providerHint: "asaas" }
        ),
      /Webhook Asaas nao autorizado/
    );

    await assert.rejects(
      () =>
        service.handleWebhook(
          { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
          { "asaas-access-token": "invalid-token" },
          { providerHint: "asaas" }
        ),
      /Webhook Asaas nao autorizado/
    );

    await assert.rejects(
      () =>
        service.handleWebhook(
          { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } },
          { "asaas-access-token": "valid-webhook-token" },
          { providerHint: "asaas" }
        ),
      /Gateway de pagamento desativado/
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

describe("integrated stock rules", () => {
  function createStockHarness(initial = 5, controlled = true) {
    let product = {
      id: "product-1",
      storeId: "store-1",
      name: "Produto controlado",
      stockControlEnabled: controlled,
      stockQuantity: new Prisma.Decimal(initial),
      minimumStock: new Prisma.Decimal(1),
      allowNegativeStock: false,
      price: new Prisma.Decimal(10),
      imageKey: null
    };
    const movements: Array<Record<string, unknown>> = [];
    const tx = {
      $queryRaw: async () => [{ id: product.id }],
      product: {
        findFirst: async ({ where }: { where: { id: string; storeId?: string } }) =>
          where.id === product.id && (!where.storeId || where.storeId === product.storeId) ? product : null,
        findUniqueOrThrow: async () => product,
        update: async ({ data }: { data: { stockQuantity?: Prisma.Decimal; stockControlEnabled?: boolean; minimumStock?: Prisma.Decimal; allowNegativeStock?: boolean; stockUpdatedAt?: Date } }) => {
          product = { ...product, ...data } as typeof product;
          return product;
        }
      },
      stockMovement: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          movements.find((movement) =>
            movement.productId === where.productId &&
            movement.type === where.type &&
            (where.saleId === undefined || movement.saleId === where.saleId) &&
            (where.orderId === undefined || movement.orderId === where.orderId)
          ) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const movement = { id: `movement-${movements.length + 1}`, createdAt: new Date(), ...data };
          movements.push(movement);
          return movement;
        }
      }
    };
    const prisma = {
      product: { findFirst: tx.product.findFirst },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    };
    const stores = { getStoreByOwner: async () => ({ id: "store-1" }) };
    const service = new StockService(prisma as never, stores as never);
    return { service, tx, movements, getProduct: () => product };
  }

  it("baixa PDV uma vez e ignora produto sem controle", async () => {
    const controlled = createStockHarness(5, true);
    await controlled.service.consumeForSale(controlled.tx as never, "store-1", "user-1", "sale-1", [{ productId: "product-1", quantity: 2 }]);
    await controlled.service.consumeForSale(controlled.tx as never, "store-1", "user-1", "sale-1", [{ productId: "product-1", quantity: 2 }]);
    assert.equal(Number(controlled.getProduct().stockQuantity), 3);
    assert.equal(controlled.movements.length, 1);
    assert.equal(controlled.movements[0]?.type, StockMovementType.PDV_SALE);

    const uncontrolled = createStockHarness(5, false);
    await uncontrolled.service.consumeForSale(uncontrolled.tx as never, "store-1", "user-1", "sale-2", [{ productId: "product-1", quantity: 2 }]);
    assert.equal(Number(uncontrolled.getProduct().stockQuantity), 5);
    assert.equal(uncontrolled.movements.length, 0);
  });

  it("bloqueia consumo acima do saldo sem criar movimento", async () => {
    const harness = createStockHarness(1);
    await assert.rejects(
      harness.service.reserveForOrder(harness.tx as never, "store-1", "client-1", "order-1", [{ productId: "product-1", quantity: 2 }]),
      /Estoque insuficiente/
    );
    assert.equal(Number(harness.getProduct().stockQuantity), 1);
    assert.equal(harness.movements.length, 0);
  });

  it("reserva delivery e libera o saldo apenas uma vez", async () => {
    const harness = createStockHarness(4);
    const reservationRows: Array<Record<string, unknown>> = harness.movements;
    Object.assign(harness.tx.stockMovement, {
      findMany: async () => reservationRows.filter((item) => item.type === StockMovementType.DELIVERY_RESERVED)
    });
    await harness.service.reserveForOrder(harness.tx as never, "store-1", "client-1", "order-1", [{ productId: "product-1", quantity: 2 }]);
    await harness.service.releaseOrderReservation(harness.tx as never, "order-1", "store-user");
    await harness.service.releaseOrderReservation(harness.tx as never, "order-1", "store-user");
    assert.equal(Number(harness.getProduct().stockQuantity), 4);
    assert.equal(harness.movements.filter((item) => item.type === StockMovementType.DELIVERY_RELEASED).length, 1);
  });

  it("bloqueia produtos em ordem deterministica antes de criar itens do pedido", async () => {
    const harness = createStockHarness(2);
    const lockedIds: string[] = [];
    (harness.tx as unknown as {
      $queryRaw: (query: { values?: unknown[] }) => Promise<Array<{ id: unknown }>>;
    }).$queryRaw = async (query) => {
      lockedIds.push(String(query.values?.[0]));
      return [{ id: query.values?.[0] }];
    };

    await harness.service.lockProductsForOrder(
      harness.tx as never,
      ["product-b", "product-a", "product-b"]
    );

    assert.deepEqual(lockedIds, ["product-a", "product-b"]);
  });
});
