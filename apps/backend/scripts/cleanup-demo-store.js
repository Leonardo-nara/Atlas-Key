/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL nao encontrada. Execute no ambiente correto antes da limpeza demo.");
  process.exit(1);
}

const prisma = new PrismaClient();
const APPLY_FLAG = "--apply";
const CONFIRM_ENV_VALUE = "DELETE_DEMO_STORE";
const REQUIRED_STORE_NAME = "DEMO Mototake";

function isApplyMode() {
  return process.argv.includes(APPLY_FLAG);
}

function readRecordFile() {
  const recordFile = process.env.DEMO_CLEANUP_RECORD_FILE;

  if (!recordFile) {
    return null;
  }

  const absolutePath = path.resolve(recordFile);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo de registro demo nao encontrado: ${absolutePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

async function collectDemoData() {
  const record = readRecordFile();
  const storeId = process.env.DEMO_STORE_ID || record?.store?.id;
  const storeName = process.env.DEMO_STORE_NAME || record?.store?.name;
  const demoPrefix = process.env.DEMO_PREFIX || record?.demoPrefix;

  if (!storeId) {
    throw new Error("Defina DEMO_STORE_ID ou informe DEMO_CLEANUP_RECORD_FILE com store.id.");
  }

  if (storeName !== REQUIRED_STORE_NAME) {
    throw new Error(`Limpeza bloqueada. DEMO_STORE_NAME precisa ser exatamente "${REQUIRED_STORE_NAME}".`);
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      owner: { select: { id: true, name: true, email: true, role: true } }
    }
  });

  if (!store) {
    return emptyData(record, demoPrefix);
  }

  if (store.name !== REQUIRED_STORE_NAME) {
    throw new Error(`Limpeza bloqueada. A loja ${store.id} tem nome "${store.name}", nao "${REQUIRED_STORE_NAME}".`);
  }

  if (store.owner.role !== "STORE_ADMIN") {
    throw new Error(`Limpeza bloqueada. O dono da loja nao e STORE_ADMIN: ${store.owner.email}.`);
  }

  if (demoPrefix && !store.owner.email.toLowerCase().includes(demoPrefix.toLowerCase())) {
    throw new Error("Limpeza bloqueada. O email do dono nao contem o prefixo demo registrado.");
  }

  const userIds = uniq([store.ownerUserId, ...(record?.users ?? []).map((user) => user.id), ...(record?.userIds ?? [])]);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ storeId: store.id }, { clientId: { in: userIds } }, { courierId: { in: userIds } }]
    },
    select: { id: true, customerName: true, storeId: true, clientId: true, courierId: true, status: true },
    orderBy: { createdAt: "asc" }
  });

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, storeId: true },
    orderBy: { createdAt: "asc" }
  });

  const sales = await prisma.sale.findMany({
    where: { storeId: store.id },
    select: { id: true, storeId: true, operatorUserId: true, status: true, customerName: true },
    orderBy: { createdAt: "asc" }
  });

  const cashRegisters = await prisma.cashRegister.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, storeId: true },
    orderBy: { createdAt: "asc" }
  });

  const cashRegisterSessions = await prisma.cashRegisterSession.findMany({
    where: { storeId: store.id },
    select: { id: true, cashRegisterId: true, storeId: true, status: true },
    orderBy: { openedAt: "asc" }
  });

  const cashMovements = await prisma.cashMovement.findMany({
    where: { storeId: store.id },
    select: { id: true, type: true, amount: true, saleId: true },
    orderBy: { createdAt: "asc" }
  });

  const stockMovements = await prisma.stockMovement.findMany({
    where: { storeId: store.id },
    select: { id: true, productId: true, type: true, orderId: true, saleId: true },
    orderBy: { createdAt: "asc" }
  });

  const deliveryZones = await prisma.storeDeliveryZone.findMany({
    where: { storeId: store.id },
    select: { id: true, name: true, district: true, storeId: true },
    orderBy: { createdAt: "asc" }
  });

  const courierLinks = await prisma.storeCourierLink.findMany({
    where: {
      OR: [{ storeId: store.id }, { courierId: { in: userIds } }]
    },
    select: { id: true, storeId: true, courierId: true, status: true },
    orderBy: { createdAt: "asc" }
  });

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { createdAt: "asc" }
      })
    : [];

  const authSessions = await prisma.authSession.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, revokedAt: true },
    orderBy: { createdAt: "asc" }
  });

  return {
    record,
    demoPrefix,
    store,
    users,
    products,
    deliveryZones,
    orders,
    sales,
    cashRegisters,
    cashRegisterSessions,
    cashMovements,
    stockMovements,
    courierLinks,
    authSessions
  };
}

function emptyData(record, demoPrefix) {
  return {
    record,
    demoPrefix,
    store: null,
    users: [],
    products: [],
    deliveryZones: [],
    orders: [],
    sales: [],
    cashRegisters: [],
    cashRegisterSessions: [],
    cashMovements: [],
    stockMovements: [],
    courierLinks: [],
    authSessions: []
  };
}

function printData(data) {
  console.log(`Modo: ${isApplyMode() ? "APPLY" : "DRY-RUN"}`);

  if (!data.store) {
    console.log("Nenhuma loja demo encontrada para o storeId informado.");
    return;
  }

  console.log(`Loja: ${data.store.id} | ${data.store.name} | owner=${data.store.owner.email}`);
  console.log(`Usuarios: ${data.users.length}`);
  data.users.forEach((user) => console.log(`- ${user.id} | ${user.role} | ${user.email}`));
  console.log(`Produtos: ${data.products.length}`);
  data.products.forEach((product) => console.log(`- ${product.id} | ${product.name}`));
  console.log(`Taxas por bairro: ${data.deliveryZones.length}`);
  data.deliveryZones.forEach((zone) => console.log(`- ${zone.id} | ${zone.name} | ${zone.district}`));
  console.log(`Pedidos: ${data.orders.length}`);
  data.orders.forEach((order) => console.log(`- ${order.id} | ${order.status} | ${order.customerName}`));
  console.log(`Vendas PDV: ${data.sales.length}`);
  data.sales.forEach((sale) => console.log(`- ${sale.id} | ${sale.status} | ${sale.customerName ?? "sem cliente"}`));
  console.log(`Caixas: ${data.cashRegisters.length}`);
  data.cashRegisters.forEach((cashRegister) => console.log(`- ${cashRegister.id} | ${cashRegister.name}`));
  console.log(`Sessoes de caixa: ${data.cashRegisterSessions.length}`);
  console.log(`Movimentos de caixa: ${data.cashMovements.length}`);
  console.log(`Movimentos de estoque: ${data.stockMovements.length}`);
  console.log(`Vinculos de motoboy: ${data.courierLinks.length}`);
  console.log(`Sessoes de auth: ${data.authSessions.length}`);
}

async function applyCleanup(data) {
  if (!data.store) {
    return {};
  }

  if (process.env.DEMO_CLEANUP_CONFIRM !== CONFIRM_ENV_VALUE) {
    throw new Error(`Limpeza real bloqueada. Defina DEMO_CLEANUP_CONFIRM=${CONFIRM_ENV_VALUE}.`);
  }

  const storeId = data.store.id;
  const userIds = data.users.map((user) => user.id);
  const orderIds = data.orders.map((order) => order.id);
  const saleIds = data.sales.map((sale) => sale.id);
  const sessionIds = data.cashRegisterSessions.map((session) => session.id);

  return prisma.$transaction(async (transaction) => {
    const paymentTransactions = await transaction.paymentTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    const stockMovements = await transaction.stockMovement.deleteMany({ where: { storeId } });
    const orderEvents = await transaction.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    const orderItems = await transaction.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    const orders = await transaction.order.deleteMany({ where: { id: { in: orderIds } } });
    const saleEvents = await transaction.saleEvent.deleteMany({ where: { saleId: { in: saleIds } } });
    const salePayments = await transaction.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    const saleItems = await transaction.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    const cashMovements = await transaction.cashMovement.deleteMany({ where: { storeId } });
    const sales = await transaction.sale.deleteMany({ where: { id: { in: saleIds } } });
    const cashRegisterSessions = await transaction.cashRegisterSession.deleteMany({ where: { id: { in: sessionIds } } });
    const cashRegisters = await transaction.cashRegister.deleteMany({ where: { storeId } });
    const courierLinks = await transaction.storeCourierLink.deleteMany({
      where: { OR: [{ storeId }, { courierId: { in: userIds } }] }
    });
    const deliveryZones = await transaction.storeDeliveryZone.deleteMany({ where: { storeId } });
    const products = await transaction.product.deleteMany({ where: { storeId } });
    const store = await transaction.store.deleteMany({ where: { id: storeId } });
    const authSessions = await transaction.authSession.deleteMany({ where: { userId: { in: userIds } } });
    const clientAddresses = await transaction.clientAddress.deleteMany({ where: { userId: { in: userIds } } });
    const courierProfiles = await transaction.courierProfile.deleteMany({ where: { userId: { in: userIds } } });
    const users = await transaction.user.deleteMany({ where: { id: { in: userIds } } });

    return {
      paymentTransactions: paymentTransactions.count,
      stockMovements: stockMovements.count,
      orderEvents: orderEvents.count,
      orderItems: orderItems.count,
      orders: orders.count,
      saleEvents: saleEvents.count,
      salePayments: salePayments.count,
      saleItems: saleItems.count,
      cashMovements: cashMovements.count,
      sales: sales.count,
      cashRegisterSessions: cashRegisterSessions.count,
      cashRegisters: cashRegisters.count,
      courierLinks: courierLinks.count,
      deliveryZones: deliveryZones.count,
      products: products.count,
      stores: store.count,
      authSessions: authSessions.count,
      clientAddresses: clientAddresses.count,
      courierProfiles: courierProfiles.count,
      users: users.count
    };
  });
}

async function main() {
  const data = await collectDemoData();
  printData(data);

  if (!isApplyMode()) {
    console.log("Dry-run concluido. Para aplicar, adicione --apply e DEMO_CLEANUP_CONFIRM=DELETE_DEMO_STORE.");
    return;
  }

  const result = await applyCleanup(data);
  console.log("Limpeza demo aplicada:");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
