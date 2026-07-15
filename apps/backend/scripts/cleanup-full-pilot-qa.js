const { PrismaClient } = require("@prisma/client");
const { PREFIX, assertCleanupGuard, assertNoSecrets } = require("./full-pilot-qa-helpers");

const prisma = new PrismaClient();

async function collect(tx) {
  const users = await tx.user.findMany({
    where: { OR: [{ email: { startsWith: PREFIX.toLowerCase() } }, { name: { startsWith: PREFIX } }] },
    select: { id: true, email: true, name: true }
  });
  const stores = await tx.store.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true, name: true }
  });
  const userIds = users.map((item) => item.id);
  const storeIds = stores.map((item) => item.id);
  const counts = {
    users: users.length,
    stores: stores.length,
    products: await tx.product.count({ where: { storeId: { in: storeIds } } }),
    zones: await tx.storeDeliveryZone.count({ where: { storeId: { in: storeIds } } }),
    links: await tx.storeCourierLink.count({ where: { OR: [{ storeId: { in: storeIds } }, { courierId: { in: userIds } }] } }),
    orders: await tx.order.count({ where: { storeId: { in: storeIds } } }),
    orderItems: await tx.orderItem.count({ where: { order: { storeId: { in: storeIds } } } }),
    sales: await tx.sale.count({ where: { storeId: { in: storeIds } } }),
    saleItems: await tx.saleItem.count({ where: { sale: { storeId: { in: storeIds } } } }),
    salePayments: await tx.salePayment.count({ where: { sale: { storeId: { in: storeIds } } } }),
    cashRegisters: await tx.cashRegister.count({ where: { storeId: { in: storeIds } } }),
    cashSessions: await tx.cashRegisterSession.count({ where: { storeId: { in: storeIds } } }),
    cashMovements: await tx.cashMovement.count({ where: { storeId: { in: storeIds } } }),
    stockMovements: await tx.stockMovement.count({ where: { storeId: { in: storeIds } } }),
    sessions: await tx.authSession.count({ where: { userId: { in: userIds } } }),
    clientAddresses: await tx.clientAddress.count({ where: { userId: { in: userIds } } }),
    courierProfiles: await tx.courierProfile.count({ where: { userId: { in: userIds } } })
  };
  return { users, stores, userIds, storeIds, counts };
}

async function remove(tx, found) {
  const { userIds, storeIds } = found;
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

async function main() {
  assertCleanupGuard();
  const apply = process.argv.includes("--apply");

  const result = await prisma.$transaction(async (tx) => {
    const found = await collect(tx);
    const unsafeStore = found.stores.find((item) => !item.name.startsWith(PREFIX));
    const unsafeUser = found.users.find((item) => !item.name.startsWith(PREFIX) && !item.email.startsWith(PREFIX.toLowerCase()));
    if (unsafeStore || unsafeUser) {
      throw new Error("Cleanup interrompido: candidato fora do prefixo exato");
    }
    if (apply) await remove(tx, found);
    return {
      mode: apply ? "apply" : "dry-run",
      stores: found.stores,
      users: found.users.map((item) => ({ id: item.id, email: item.email, name: item.name })),
      counts: found.counts
    };
  }, { timeout: 20000 });

  assertNoSecrets(result);
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
