import "reflect-metadata";
import { Readable } from "node:stream";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Injectable,
  Module,
  NotFoundException,
  ValidationPipe
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import { UserRole } from "../src/common/enums/user-role.enum";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { OrdersController } from "../src/orders/orders.controller";
import { OrdersService } from "../src/orders/orders.service";
import { StoresController } from "../src/stores/stores.controller";
import { StoresService } from "../src/stores/stores.service";

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
  create: () => ({ id: "order-created" }),
  createClientOrder: () => ({ id: "client-order-created" }),
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

const storesServiceMock = {
  getStoreByOwner: () => ({ id: "store-1", name: "Loja", address: "Rua", active: true }),
  listDeliveryZones: () => [],
  getPixSettings: () => ({ pixEnabled: false }),
  updatePixSettings: () => ({ pixEnabled: true }),
  createDeliveryZone: () => ({ id: "zone-created" }),
  updateDeliveryZone: () => ({ id: "zone-updated" }),
  deactivateDeliveryZone: () => ({ id: "zone-deactivated" })
};

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: TEST_JWT_SECRET,
      signOptions: { expiresIn: "5m" }
    })
  ],
  controllers: [OrdersController, StoresController],
  providers: [
    SmokeJwtStrategy,
    RolesGuard,
    { provide: OrdersService, useValue: ordersServiceMock },
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
      store: await jwtService.signAsync(actorByName.store)
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
});
