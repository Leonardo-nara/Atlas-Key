/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const {
  STORE_EMPTY_NAME,
  STORE_OTHER_NAME,
  STORE_PARTIAL_NAME,
  STORE_READY_NAME,
  assertQaStoreNames,
  printSafeContext,
  readManifest,
  removeManifest,
  requireSandboxSafety
} = require("./readiness-qa-helpers");

const prisma = new PrismaClient();
const applyMode = process.argv.includes("--apply");

async function main() {
  const context = requireSandboxSafety({ cleanupConfirm: applyMode });
  printSafeContext(context);
  console.log(`Modo: ${applyMode ? "APPLY" : "DRY-RUN"}`);

  const data = await collect();
  assertQaStoreNames(data.stores);
  printSummary(data);

  if (data.stores.length === 0 && data.users.length === 0) {
    console.log("Nenhum dado QA Readiness encontrado.");
    removeManifest();
    return;
  }

  if (!applyMode) {
    console.log("Dry-run concluido. Nada foi removido.");
    console.log("Para remover: QA_READINESS_ENV=sandbox QA_READINESS_ALLOW_NODE_ENV_PRODUCTION=true QA_READINESS_CLEANUP_CONFIRM=DELETE_READINESS_QA pnpm --filter @deliveries/backend readiness:qa:cleanup:prod -- --apply");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.deleteMany({ where: { orderId: { in: data.orderIds } } });
    await tx.orderEvent.deleteMany({ where: { orderId: { in: data.orderIds } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: data.orderIds } } });
    await tx.stockMovement.deleteMany({ where: { OR: [{ storeId: { in: data.storeIds } }, { orderId: { in: data.orderIds } }, { saleId: { in: data.saleIds } }] } });
    await tx.cashMovement.deleteMany({ where: { OR: [{ storeId: { in: data.storeIds } }, { saleId: { in: data.saleIds } }, { cashRegisterSessionId: { in: data.cashSessionIds } }] } });
    await tx.saleEvent.deleteMany({ where: { saleId: { in: data.saleIds } } });
    await tx.salePayment.deleteMany({ where: { saleId: { in: data.saleIds } } });
    await tx.saleItem.deleteMany({ where: { saleId: { in: data.saleIds } } });
    await tx.sale.deleteMany({ where: { id: { in: data.saleIds } } });
    await tx.order.deleteMany({ where: { id: { in: data.orderIds } } });
    await tx.cashRegisterSession.deleteMany({ where: { id: { in: data.cashSessionIds } } });
    await tx.cashRegister.deleteMany({ where: { id: { in: data.cashRegisterIds } } });
    await tx.storeCourierLink.deleteMany({ where: { OR: [{ storeId: { in: data.storeIds } }, { courierId: { in: data.userIds } }] } });
    await tx.storeDeliveryZone.deleteMany({ where: { storeId: { in: data.storeIds } } });
    await tx.product.deleteMany({ where: { id: { in: data.productIds } } });
    await tx.courierProfile.deleteMany({ where: { userId: { in: data.userIds } } });
    await tx.clientAddress.deleteMany({ where: { userId: { in: data.userIds } } });
    await tx.authSession.deleteMany({ where: { userId: { in: data.userIds } } });
    await tx.authAuditEvent.deleteMany({ where: { userId: { in: data.userIds } } });
    await tx.adminAuditLog.deleteMany({ where: { adminUserId: { in: data.userIds } } });
    await tx.store.deleteMany({ where: { id: { in: data.storeIds } } });
    await tx.user.deleteMany({ where: { id: { in: data.userIds } } });
  });

  removeManifest();
  const after = await collect();
  printSummary(after, "Apos limpeza");
  if (after.stores.length > 0 || after.users.length > 0 || after.products.length > 0) {
    throw new Error("Limpeza incompleta: ainda existem dados QA Readiness.");
  }
  console.log("Limpeza QA Readiness concluida com zero residuos principais.");
}

async function collect() {
  const manifest = readManifest();
  const storeNames = [STORE_EMPTY_NAME, STORE_PARTIAL_NAME, STORE_READY_NAME, STORE_OTHER_NAME];
  const userEmails = [
    "qa-readiness-empty@example.test",
    "qa-readiness-partial@example.test",
    "qa-readiness-ready@example.test",
    "qa-readiness-other@example.test",
    "qa-readiness-client@example.test",
    "qa-readiness-courier@example.test",
    "qa-readiness-platform@example.test"
  ];
  const stores = await prisma.store.findMany({
    where: { name: { in: storeNames } },
    select: { id: true, name: true, ownerUserId: true }
  });
  const manifestUserIds = Object.values(manifest?.ids ?? {}).filter((value) =>
    String(value).startsWith("qa_readiness_owner_") ||
    ["qa_readiness_client", "qa_readiness_courier", "qa_readiness_platform"].includes(String(value))
  );
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: userEmails } }, { id: { in: manifestUserIds } }] },
    select: { id: true, email: true, name: true, role: true }
  });
  const storeIds = stores.map((store) => store.id);
  const userIds = [...new Set([...users.map((user) => user.id), ...stores.map((store) => store.ownerUserId)])];
  const [products, sales, orders, cashRegisters, cashSessions] = await Promise.all([
    prisma.product.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, name: true, storeId: true } }),
    prisma.sale.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, customerName: true, storeId: true } }),
    prisma.order.findMany({ where: { OR: [{ storeId: { in: storeIds } }, { clientId: { in: userIds } }, { courierId: { in: userIds } }] }, select: { id: true, customerName: true, storeId: true } }),
    prisma.cashRegister.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, name: true, storeId: true } }),
    prisma.cashRegisterSession.findMany({ where: { storeId: { in: storeIds } }, select: { id: true, storeId: true, status: true } })
  ]);

  return {
    stores,
    users,
    products,
    sales,
    orders,
    cashRegisters,
    cashSessions,
    storeIds,
    userIds,
    productIds: products.map((item) => item.id),
    saleIds: sales.map((item) => item.id),
    orderIds: orders.map((item) => item.id),
    cashRegisterIds: cashRegisters.map((item) => item.id),
    cashSessionIds: cashSessions.map((item) => item.id)
  };
}

function printSummary(data, title = "Dry-run") {
  console.log(title);
  console.log(`- lojas: ${data.stores.length} (${data.stores.map((item) => item.name).join(", ") || "nenhuma"})`);
  console.log(`- usuarios: ${data.users.length}`);
  console.log(`- produtos: ${data.products.length}`);
  console.log(`- vendas: ${data.sales.length}`);
  console.log(`- pedidos: ${data.orders.length}`);
  console.log(`- caixas: ${data.cashRegisters.length}`);
  console.log(`- sessoes de caixa: ${data.cashSessions.length}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
