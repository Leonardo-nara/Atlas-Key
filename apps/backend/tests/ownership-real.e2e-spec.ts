import "reflect-metadata";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CourierVehicleType,
  OrderEventType,
  OrderFulfillmentType,
  OrderPaymentMethod,
  OrderPaymentProofStatus,
  OrderPaymentProvider,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  StoreCourierLinkRequestedBy,
  StoreCourierLinkStatus,
  StoreStatus,
  UserRole,
  UserStatus
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_PASSWORD = "SenhaE2e!12345";

type LoginKey = "platform" | "storeA" | "storeB" | "clientA" | "clientB" | "courierA";

type SeedData = {
  users: Record<LoginKey | "courierB", { id: string; email: string }>;
  stores: {
    storeA: { id: string };
    storeB: { id: string };
  };
  products: {
    productA: { id: string };
    productB: { id: string };
  };
  orders: {
    orderA: { id: string };
    orderB: { id: string };
  };
};

describe("backend real e2e ownership/security", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let seed: SeedData;
  const tokens = new Map<LoginKey, string>();

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );

    await app.listen(0, "127.0.0.1");
    prisma = app.get(PrismaService);
    seed = await seedOwnershipData(prisma);

    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api`;

    for (const loginKey of ["platform", "storeA", "storeB", "clientA", "clientB", "courierA"] as const) {
      tokens.set(loginKey, await login(loginKey));
    }
  });

  after(async () => {
    await app?.close();
  });

  it("protege auditoria administrativa por token e role", async () => {
    await expectStatus("GET", "/admin/audit-logs", undefined, 401);
    await expectStatus("GET", "/admin/audit-logs", tokens.get("storeA"), 403);
    await expectStatus("GET", "/admin/audit-logs", tokens.get("clientA"), 403);
    await expectStatus("GET", "/admin/audit-logs", tokens.get("courierA"), 403);

    const response = await requestJson("GET", "/admin/audit-logs", tokens.get("platform"));
    assert.equal(response.status, 200);
  });

  it("bloqueia loja A de acessar ou alterar dados da loja B", async () => {
    await expectStatus(
      "GET",
      `/orders/${seed.orders.orderB.id}/history`,
      tokens.get("storeA"),
      404
    );
    await expectStatus(
      "PATCH",
      `/orders/${seed.orders.orderB.id}/payment-proof/approve`,
      tokens.get("storeA"),
      404,
      { reason: "Tentativa indevida e2e" }
    );
    await expectStatus(
      "PATCH",
      `/orders/${seed.orders.orderB.id}/payment/paid`,
      tokens.get("storeA"),
      404
    );
  });

  it("bloqueia cliente A de acessar pedido e comprovante do cliente B", async () => {
    const ownOrders = await requestJson("GET", "/orders/client/my", tokens.get("clientA"));
    assert.equal(ownOrders.status, 200);
    assert.ok(Array.isArray(ownOrders.body.items));
    assert.ok(
      ownOrders.body.items.some((order: { id: string }) => order.id === seed.orders.orderA.id)
    );
    assert.ok(
      ownOrders.body.items.every((order: { id: string }) => order.id !== seed.orders.orderB.id)
    );

    await expectStatus(
      "GET",
      `/orders/${seed.orders.orderB.id}/payment-proof/file`,
      tokens.get("clientA"),
      404
    );
  });

  it("mantem motoboy sem acesso a comprovante e gestao de pagamento", async () => {
    await expectStatus(
      "GET",
      `/orders/${seed.orders.orderB.id}/payment-proof/file`,
      tokens.get("courierA"),
      403
    );
    await expectStatus(
      "PATCH",
      `/orders/${seed.orders.orderB.id}/payment/paid`,
      tokens.get("courierA"),
      403
    );
  });

  it("bloqueia cliente de aprovar comprovante de pagamento", async () => {
    await expectStatus(
      "PATCH",
      `/orders/${seed.orders.orderA.id}/payment-proof/approve`,
      tokens.get("clientA"),
      403,
      { reason: "Cliente nao pode aprovar" }
    );
  });

  it("bloqueia login de usuario suspenso", async () => {
    await prisma.user.update({
      where: { id: seed.users.clientB.id },
      data: {
        active: false,
        status: UserStatus.SUSPENDED
      }
    });

    await expectStatus("POST", "/auth/login", undefined, 401, {
      email: seed.users.clientB.email,
      password: TEST_PASSWORD
    });
  });

  it("esconde loja suspensa do catalogo e bloqueia novo pedido nela", async () => {
    const suspend = await requestJson(
      "PATCH",
      `/admin/stores/${seed.stores.storeB.id}/status`,
      tokens.get("platform"),
      {
        status: StoreStatus.SUSPENDED,
        reason: "Suspensao e2e"
      }
    );

    assert.equal(suspend.status, 200);
    assert.equal(suspend.body.status, StoreStatus.SUSPENDED);
    assert.equal(suspend.body.active, false);

    const catalog = await requestJson("GET", "/catalog/stores");
    assert.equal(catalog.status, 200);
    assert.ok(Array.isArray(catalog.body));
    assert.ok(catalog.body.every((store: { id: string }) => store.id !== seed.stores.storeB.id));

    await expectStatus("POST", "/orders/client", tokens.get("clientA"), 404, {
      storeId: seed.stores.storeB.id,
      fulfillmentType: OrderFulfillmentType.DELIVERY,
      addressStreet: "Rua Cliente A",
      addressNumber: "10",
      addressDistrict: "Centro",
      addressCity: "Botucatu",
      paymentMethod: OrderPaymentMethod.CASH,
      items: [
        {
          productId: seed.products.productB.id,
          quantity: 1
        }
      ]
    });
  });

  async function login(loginKey: LoginKey) {
    const response = await requestJson("POST", "/auth/login", undefined, {
      email: seed.users[loginKey].email,
      password: TEST_PASSWORD
    });

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.accessToken, "string");
    return response.body.accessToken as string;
  }

  async function expectStatus(
    method: string,
    path: string,
    token: string | undefined,
    expectedStatus: number,
    body?: unknown
  ) {
    const response = await requestJson(method, path, token, body);
    assert.equal(response.status, expectedStatus);
    return response;
  }

  async function requestJson(
    method: string,
    path: string,
    token?: string,
    body?: unknown
  ): Promise<{ status: number; body: any }> {
    const headers = new Headers();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();

    return {
      status: response.status,
      body: text ? JSON.parse(text) : null
    };
  }
});

async function seedOwnershipData(prisma: PrismaService): Promise<SeedData> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const users = await createUsers(prisma, passwordHash);
  const stores = await createStores(prisma, users);
  const products = await createProducts(prisma, stores);

  await createCourierProfilesAndLinks(prisma, users, stores);
  const orders = await createOrders(prisma, users, stores, products);

  return {
    users,
    stores,
    products,
    orders
  };
}

async function createUsers(prisma: PrismaService, passwordHash: string) {
  const data = {
    platform: await createUser(prisma, {
      name: "Admin Plataforma E2E",
      email: "platform-e2e@example.com",
      phone: "14999990000",
      passwordHash,
      role: UserRole.PLATFORM_ADMIN
    }),
    storeA: await createUser(prisma, {
      name: "Dono Loja A E2E",
      email: "store-a-e2e@example.com",
      phone: "14999990001",
      passwordHash,
      role: UserRole.STORE_ADMIN
    }),
    storeB: await createUser(prisma, {
      name: "Dono Loja B E2E",
      email: "store-b-e2e@example.com",
      phone: "14999990002",
      passwordHash,
      role: UserRole.STORE_ADMIN
    }),
    clientA: await createUser(prisma, {
      name: "Cliente A E2E",
      email: "client-a-e2e@example.com",
      phone: "14999990003",
      passwordHash,
      role: UserRole.CLIENT
    }),
    clientB: await createUser(prisma, {
      name: "Cliente B E2E",
      email: "client-b-e2e@example.com",
      phone: "14999990004",
      passwordHash,
      role: UserRole.CLIENT
    }),
    courierA: await createUser(prisma, {
      name: "Motoboy A E2E",
      email: "courier-a-e2e@example.com",
      phone: "14999990005",
      passwordHash,
      role: UserRole.COURIER
    }),
    courierB: await createUser(prisma, {
      name: "Motoboy B E2E",
      email: "courier-b-e2e@example.com",
      phone: "14999990006",
      passwordHash,
      role: UserRole.COURIER
    })
  };

  return data;
}

function createUser(
  prisma: PrismaService,
  data: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
  }
) {
  return prisma.user.create({
    data: {
      ...data,
      active: true,
      status: UserStatus.ACTIVE
    },
    select: {
      id: true,
      email: true
    }
  });
}

async function createStores(
  prisma: PrismaService,
  users: Awaited<ReturnType<typeof createUsers>>
) {
  return {
    storeA: await prisma.store.create({
      data: {
        name: "Loja A E2E",
        address: "Rua Loja A, 100",
        ownerUserId: users.storeA.id,
        active: true,
        status: StoreStatus.ACTIVE,
        pixEnabled: true,
        pixKeyType: "EMAIL",
        pixKey: "pix-a-e2e@example.com",
        pixRecipientName: "Loja A E2E",
        pixInstructions: "Envie o comprovante para conferencia manual."
      },
      select: { id: true }
    }),
    storeB: await prisma.store.create({
      data: {
        name: "Loja B E2E",
        address: "Rua Loja B, 200",
        ownerUserId: users.storeB.id,
        active: true,
        status: StoreStatus.ACTIVE,
        pixEnabled: true,
        pixKeyType: "EMAIL",
        pixKey: "pix-b-e2e@example.com",
        pixRecipientName: "Loja B E2E",
        pixInstructions: "Envie o comprovante para conferencia manual."
      },
      select: { id: true }
    })
  };
}

async function createProducts(
  prisma: PrismaService,
  stores: Awaited<ReturnType<typeof createStores>>
) {
  return {
    productA: await prisma.product.create({
      data: {
        storeId: stores.storeA.id,
        name: "Produto A E2E",
        description: "Produto da loja A",
        category: "E2E",
        price: new Prisma.Decimal("12.50"),
        available: true
      },
      select: { id: true }
    }),
    productB: await prisma.product.create({
      data: {
        storeId: stores.storeB.id,
        name: "Produto B E2E",
        description: "Produto da loja B",
        category: "E2E",
        price: new Prisma.Decimal("20.00"),
        available: true
      },
      select: { id: true }
    })
  };
}

async function createCourierProfilesAndLinks(
  prisma: PrismaService,
  users: Awaited<ReturnType<typeof createUsers>>,
  stores: Awaited<ReturnType<typeof createStores>>
) {
  await prisma.courierProfile.createMany({
    data: [
      {
        userId: users.courierA.id,
        city: "Botucatu",
        vehicleType: CourierVehicleType.MOTO,
        vehicleModel: "Honda",
        plate: "AAA1A11"
      },
      {
        userId: users.courierB.id,
        city: "Botucatu",
        vehicleType: CourierVehicleType.MOTO,
        vehicleModel: "Yamaha",
        plate: "BBB2B22"
      }
    ]
  });

  await prisma.storeCourierLink.createMany({
    data: [
      {
        courierId: users.courierA.id,
        storeId: stores.storeA.id,
        status: StoreCourierLinkStatus.APPROVED,
        requestedBy: StoreCourierLinkRequestedBy.COURIER,
        approvedAt: new Date()
      },
      {
        courierId: users.courierB.id,
        storeId: stores.storeB.id,
        status: StoreCourierLinkStatus.APPROVED,
        requestedBy: StoreCourierLinkRequestedBy.COURIER,
        approvedAt: new Date()
      }
    ]
  });
}

async function createOrders(
  prisma: PrismaService,
  users: Awaited<ReturnType<typeof createUsers>>,
  stores: Awaited<ReturnType<typeof createStores>>,
  products: Awaited<ReturnType<typeof createProducts>>
) {
  return {
    orderA: await createPixOrder(prisma, {
      storeId: stores.storeA.id,
      clientId: users.clientA.id,
      productId: products.productA.id,
      customerName: "Cliente A E2E",
      customerPhone: "14999990003",
      customerAddress: "Rua Cliente A, 10, Centro, Botucatu",
      addressDistrict: "Centro",
      unitPrice: "12.50",
      proofReference: "E2E-A-REF"
    }),
    orderB: await createPixOrder(prisma, {
      storeId: stores.storeB.id,
      clientId: users.clientB.id,
      productId: products.productB.id,
      customerName: "Cliente B E2E",
      customerPhone: "14999990004",
      customerAddress: "Rua Cliente B, 20, Bairro B, Botucatu",
      addressDistrict: "Bairro B",
      unitPrice: "20.00",
      proofReference: "E2E-B-REF"
    })
  };
}

function createPixOrder(
  prisma: PrismaService,
  input: {
    storeId: string;
    clientId: string;
    productId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    addressDistrict: string;
    unitPrice: string;
    proofReference: string;
  }
) {
  const unitPrice = new Prisma.Decimal(input.unitPrice);
  const deliveryFee = new Prisma.Decimal("0.00");

  return prisma.order.create({
    data: {
      storeId: input.storeId,
      clientId: input.clientId,
      fulfillmentType: OrderFulfillmentType.DELIVERY,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      addressStreet: input.customerAddress.split(",")[0],
      addressNumber: "10",
      addressDistrict: input.addressDistrict,
      addressCity: "Botucatu",
      subtotal: unitPrice,
      deliveryFee,
      total: unitPrice.add(deliveryFee),
      paymentMethod: OrderPaymentMethod.PIX_MANUAL,
      paymentStatus: OrderPaymentStatus.PENDING,
      paymentProvider: OrderPaymentProvider.MANUAL,
      paymentProofStatus: OrderPaymentProofStatus.SUBMITTED,
      paymentProofSubmittedAt: new Date(),
      paymentProofPayerName: input.customerName,
      paymentProofAmount: unitPrice,
      paymentProofReference: input.proofReference,
      paymentProofNotes: "Comprovante textual e2e",
      paymentProofFilePath: `e2e/${input.proofReference}.pdf`,
      paymentProofFileName: `${input.proofReference}.pdf`,
      paymentProofFileMimeType: "application/pdf",
      paymentProofFileSize: 128,
      paymentProofUploadedAt: new Date(),
      status: OrderStatus.PENDING,
      items: {
        create: [
          {
            productId: input.productId,
            nameSnapshot: "Produto E2E",
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice
          }
        ]
      },
      events: {
        create: [
          {
            type: OrderEventType.CREATED,
            actorUserId: input.clientId,
            actorRole: UserRole.CLIENT
          },
          {
            type: OrderEventType.PAYMENT_PROOF_SUBMITTED,
            actorUserId: input.clientId,
            actorRole: UserRole.CLIENT
          }
        ]
      }
    },
    select: { id: true }
  });
}
