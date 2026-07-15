const { PrismaClient, Prisma } = require("@prisma/client");
const {
  PREFIX,
  assertNoSecrets,
  assertSeedGuard,
  hashPassword,
  password,
  qaEmail,
  writeCredentials
} = require("./full-pilot-qa-helpers");

const prisma = new PrismaClient();

async function deleteExisting(tx) {
  const users = await tx.user.findMany({
    where: { OR: [{ email: { startsWith: PREFIX.toLowerCase() } }, { name: { startsWith: PREFIX } }] },
    select: { id: true }
  });
  const stores = await tx.store.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true }
  });
  const userIds = users.map((item) => item.id);
  const storeIds = stores.map((item) => item.id);

  await tx.paymentTransaction.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
  await tx.stockMovement.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.cashMovement.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.salePayment.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
  await tx.saleEvent.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
  await tx.saleItem.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
  await tx.sale.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.cashRegisterSession.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.cashRegister.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.orderEvent.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
  await tx.orderItem.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
  await tx.order.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.storeCourierLink.deleteMany({ where: { OR: [{ storeId: { in: storeIds } }, { courierId: { in: userIds } }] } });
  await tx.storeDeliveryZone.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.product.deleteMany({ where: { storeId: { in: storeIds } } });
  await tx.clientAddress.deleteMany({ where: { userId: { in: userIds } } });
  await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await tx.courierProfile.deleteMany({ where: { userId: { in: userIds } } });
  await tx.store.deleteMany({ where: { id: { in: storeIds } } });
  await tx.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createUser(tx, input) {
  return tx.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phone: input.phone,
      role: input.role,
      status: "ACTIVE",
      active: true
    }
  });
}

async function main() {
  assertSeedGuard();

  const credentials = {
    storeAdminA: password(),
    storeAdminB: password(),
    clientA: password(),
    courierA: password(),
    platform: password()
  };

  const result = await prisma.$transaction(async (tx) => {
    await deleteExisting(tx);

    const storeAdminA = await createUser(tx, {
      name: `${PREFIX}STORE_ADMIN_A`,
      email: qaEmail("store-admin-a"),
      password: credentials.storeAdminA,
      phone: "11990000001",
      role: "STORE_ADMIN"
    });
    const storeAdminB = await createUser(tx, {
      name: `${PREFIX}STORE_ADMIN_B`,
      email: qaEmail("store-admin-b"),
      password: credentials.storeAdminB,
      phone: "11990000002",
      role: "STORE_ADMIN"
    });
    const clientA = await createUser(tx, {
      name: `${PREFIX}CLIENT_A`,
      email: qaEmail("client-a"),
      password: credentials.clientA,
      phone: "11990000003",
      role: "CLIENT"
    });
    const courierA = await createUser(tx, {
      name: `${PREFIX}COURIER_A`,
      email: qaEmail("courier-a"),
      password: credentials.courierA,
      phone: "11990000004",
      role: "COURIER"
    });
    const platform = await createUser(tx, {
      name: `${PREFIX}PLATFORM_ADMIN`,
      email: qaEmail("platform-admin"),
      password: credentials.platform,
      phone: "11990000005",
      role: "PLATFORM_ADMIN"
    });

    const storeA = await tx.store.create({
      data: {
        name: `${PREFIX}STORE_A`,
        address: "Rua QA, 100 - Bairro Baixo - Botucatu - SP - CEP 18000-000",
        ownerUserId: storeAdminA.id,
        status: "ACTIVE",
        active: true,
        pixEnabled: true,
        pixKeyType: "EMAIL",
        pixKey: "pix-qa-full-pilot@example.test",
        pixRecipientName: `${PREFIX}RECEBEDOR`,
        pixInstructions: "Pix manual ficticio para QA_FULL_PILOT. Nao usar em operacao real."
      }
    });
    const storeB = await tx.store.create({
      data: {
        name: `${PREFIX}STORE_B`,
        address: "Rua QA B, 200 - Bairro Isolado - Botucatu - SP - CEP 18000-001",
        ownerUserId: storeAdminB.id,
        status: "ACTIVE",
        active: true
      }
    });

    await tx.courierProfile.create({
      data: { userId: courierA.id, city: "Botucatu", vehicleType: "MOTO", vehicleModel: "Moto QA", plate: "QAF0A00" }
    });
    await tx.storeCourierLink.create({
      data: {
        storeId: storeA.id,
        courierId: courierA.id,
        status: "APPROVED",
        requestedBy: "STORE_ADMIN"
      }
    });

    await tx.clientAddress.create({
      data: {
        userId: clientA.id,
        street: "Rua Cliente QA",
        number: "10",
        district: "Bairro Medio",
        city: "Botucatu",
        reference: "Referencia QA"
      }
    });

    const productData = [
      ["PRODUTO_NORMAL", 25.5, true, true, 12, 3, false],
      ["PRODUTO_ESTOQUE_BAIXO", 12.25, true, true, 2, 3, false],
      ["PRODUTO_ZERADO", 9.9, true, true, 0, 2, false],
      ["PRODUTO_SEM_CONTROLE", 7.5, true, false, 0, 0, false],
      ["PRODUTO_INATIVO", 13.5, false, true, 5, 1, false],
      ["PRODUTO_PRECO_ZERO", 0, true, false, 0, 0, false],
      ["=FORMULA_CSV", 3.33, true, false, 0, 0, false],
      ["PRODUTO_NEGATIVO_PERMITIDO", 4.44, true, true, 0, 1, true]
    ];
    const productsA = [];
    for (const [suffix, price, available, stockControlEnabled, stockQuantity, minimumStock, allowNegativeStock] of productData) {
      const product = await tx.product.create({
        data: {
          storeId: storeA.id,
          name: `${PREFIX}${suffix}`,
          description: `Produto QA ${suffix}`,
          price: new Prisma.Decimal(price),
          category: suffix === "=FORMULA_CSV" ? "=FORMULA_CSV" : "QA",
          available,
          stockControlEnabled,
          stockQuantity: new Prisma.Decimal(stockQuantity),
          minimumStock: new Prisma.Decimal(minimumStock),
          allowNegativeStock,
          stockUpdatedAt: stockControlEnabled ? new Date() : null
        }
      });
      productsA.push(product);
      if (stockControlEnabled) {
        await tx.stockMovement.create({
          data: {
            storeId: storeA.id,
            productId: product.id,
            createdByUserId: storeAdminA.id,
            type: "INITIAL",
            direction: "IN",
            quantity: new Prisma.Decimal(stockQuantity),
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: new Prisma.Decimal(stockQuantity),
            reason: `${PREFIX}entrada inicial`
          }
        });
      }
    }

    const productB = await tx.product.create({
      data: {
        storeId: storeB.id,
        name: `${PREFIX}STORE_B_PRODUTO_ISOLADO`,
        description: "Produto Loja B isolamento",
        price: new Prisma.Decimal(99.99),
        category: "QA",
        available: true
      }
    });

    const zones = await Promise.all([
      tx.storeDeliveryZone.create({ data: { storeId: storeA.id, name: `${PREFIX}BAIXA`, district: "Bairro Baixo", districtNormalized: "bairro baixo", fee: new Prisma.Decimal(3), isActive: true } }),
      tx.storeDeliveryZone.create({ data: { storeId: storeA.id, name: `${PREFIX}MEDIA`, district: "Bairro Medio", districtNormalized: "bairro medio", fee: new Prisma.Decimal(8), isActive: true } }),
      tx.storeDeliveryZone.create({ data: { storeId: storeA.id, name: `${PREFIX}GRATIS`, district: "Bairro Gratis", districtNormalized: "bairro gratis", fee: new Prisma.Decimal(0), isActive: true } }),
      tx.storeDeliveryZone.create({ data: { storeId: storeB.id, name: `${PREFIX}B_ISOLADA`, district: "Bairro B", districtNormalized: "bairro b", fee: new Prisma.Decimal(20), isActive: true } })
    ]);

    const cashRegister = await tx.cashRegister.create({
      data: { storeId: storeA.id, name: `${PREFIX}CAIXA_A`, active: true }
    });

    return {
      storeA,
      storeB,
      users: { storeAdminA, storeAdminB, clientA, courierA, platform },
      productsA,
      productB,
      zones,
      cashRegister
    };
  }, { timeout: 20000 });

  const credentialsPath = writeCredentials({
    createdAt: new Date().toISOString(),
    apiUrl: "https://rotapronta-api-sandbox-production.up.railway.app/api",
    emails: {
      storeAdminA: qaEmail("store-admin-a"),
      storeAdminB: qaEmail("store-admin-b"),
      clientA: qaEmail("client-a"),
      courierA: qaEmail("courier-a"),
      platform: qaEmail("platform-admin")
    },
    passwords: credentials,
    ids: {
      storeA: result.storeA.id,
      storeB: result.storeB.id,
      productsA: result.productsA.map((item) => item.id),
      productB: result.productB.id,
      cashRegister: result.cashRegister.id
    }
  });

  const output = {
    created: true,
    prefix: PREFIX,
    storeA: result.storeA.id,
    storeB: result.storeB.id,
    users: Object.fromEntries(Object.entries(result.users).map(([key, value]) => [key, value.id])),
    productsA: result.productsA.length,
    zones: result.zones.length,
    cashRegister: result.cashRegister.id,
    credentialsPath,
    secretsPrinted: false
  };
  assertNoSecrets(output);
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
