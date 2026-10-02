/* eslint-disable no-console */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const emails = [...new Set((process.env.CLEAN_PRODUCTION_TEST_EMAILS || "")
  .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))];
const preserveId = process.env.CLEAN_PRODUCTION_PRESERVE_ADMIN_ID;
const apply = process.argv.includes("--apply");

async function run() {
  if (!preserveId || !emails.length || emails.some((email) =>
    !/^[^@]+@(example\.com|example\.org|qa\.local|test\.local|smoke\.local)$/.test(email))) {
    throw new Error("Informe admin preservado e emails sinteticos exatos revisados. Emails pessoais bloqueados.");
  }
  if (apply) {
    if (process.env.CLEAN_PRODUCTION_CONFIRM !== "DELETE_REVIEWED_SYNTHETIC_DATA") {
      throw new Error("Confirmacao explicita de producao ausente.");
    }
    const backup = process.env.CLEAN_PRODUCTION_BACKUP_FILE;
    const expected = process.env.CLEAN_PRODUCTION_BACKUP_SHA256?.toLowerCase();
    if (!backup || !expected || !fs.existsSync(backup) ||
      crypto.createHash("sha256").update(fs.readFileSync(backup)).digest("hex") !== expected) {
      throw new Error("Backup previo ausente ou hash divergente.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { id: preserveId } });
    if (!admin || !["PLATFORM_ADMIN", "SUPER_ADMIN"].includes(admin.role) ||
      !admin.active || admin.status !== "ACTIVE" || emails.includes(admin.email.toLowerCase())) {
      throw new Error("Conta administrativa preservada nao validada.");
    }
    const users = await tx.user.findMany({
      where: { email: { in: emails }, id: { not: preserveId } },
      select: { id: true, email: true, role: true }
    });
    const userIds = users.map((user) => user.id);
    const stores = await tx.store.findMany({
      where: { ownerUserId: { in: userIds } }, select: { id: true, name: true }
    });
    const storeIds = stores.map((store) => store.id);
    // Refuse to remove a synthetic account participating in another store's operations.
    const outside = { notIn: storeIds };
    const crossReferences = await Promise.all([
      tx.order.count({ where: { storeId: outside, OR: [
        { clientId: { in: userIds } }, { courierId: { in: userIds } }
      ] } }),
      tx.sale.count({ where: { storeId: outside, operatorUserId: { in: userIds } } }),
      tx.cashMovement.count({ where: { storeId: outside, userId: { in: userIds } } }),
      tx.cashRegisterSession.count({ where: { storeId: outside, OR: [
        { openedByUserId: { in: userIds } }, { closedByUserId: { in: userIds } }
      ] } }),
      tx.storeCourierLink.count({ where: { storeId: outside, courierId: { in: userIds } } }),
      tx.orderEvent.count({ where: { actorUserId: { in: userIds }, order: { storeId: outside } } }),
      tx.saleEvent.count({ where: { actorUserId: { in: userIds }, sale: { storeId: outside } } }),
      tx.stockMovement.count({ where: { createdByUserId: { in: userIds }, storeId: outside } }),
      tx.orderItem.count({ where: { product: { storeId: { in: storeIds } }, order: { storeId: outside } } }),
      tx.saleItem.count({ where: { product: { storeId: { in: storeIds } }, sale: { storeId: outside } } })
    ]);
    if (crossReferences.some(Boolean)) throw new Error("Vinculo com dados fora das lojas sinteticas: limpeza bloqueada.");
    const orders = await tx.order.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } });
    const sales = await tx.sale.findMany({ where: { storeId: { in: storeIds } }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);
    const saleIds = sales.map((sale) => sale.id);
    const filters = [
      ["cashMovement", { storeId: { in: storeIds } }],
      ["stockMovement", { storeId: { in: storeIds } }],
      ["paymentTransaction", { orderId: { in: orderIds } }],
      ["orderEvent", { orderId: { in: orderIds } }],
      ["orderItem", { orderId: { in: orderIds } }],
      ["order", { id: { in: orderIds } }],
      ["saleEvent", { saleId: { in: saleIds } }],
      ["salePayment", { saleId: { in: saleIds } }],
      ["saleItem", { saleId: { in: saleIds } }],
      ["sale", { id: { in: saleIds } }],
      ["cashRegisterSession", { storeId: { in: storeIds } }],
      ["cashRegister", { storeId: { in: storeIds } }],
      ["storeCourierLink", { storeId: { in: storeIds } }],
      ["storeDeliveryZone", { storeId: { in: storeIds } }],
      ["product", { storeId: { in: storeIds } }],
      ["store", { id: { in: storeIds } }],
      ["deviceToken", { userId: { in: userIds } }],
      ["clientAddress", { userId: { in: userIds } }],
      ["courierProfile", { userId: { in: userIds } }],
      ["authSession", { userId: { in: userIds } }],
      ["authAuditEvent", { OR: [{ userId: { in: userIds } }, { email: { in: emails } }] }],
      ["adminAuditLog", { OR: [{ adminUserId: { in: userIds } }, { targetId: { in: [...userIds, ...storeIds] } }] }],
      ["user", { id: { in: userIds }, NOT: { id: preserveId } }]
    ];
    const counts = {};
    for (const [model, where] of filters) counts[model] = await tx[model].count({ where });
    console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", stores, users, counts }));
    if (apply) {
      const removed = {};
      for (const [model, where] of filters) removed[model] = (await tx[model].deleteMany({ where })).count;
      console.log(JSON.stringify({ removed, adminPreserved: true }));
    }
  }, { isolationLevel: "Serializable", timeout: 60_000 });
}

run().catch(() => {
  console.error("Limpeza bloqueada. Transacao revertida; revise parametros, backup e referencias.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
