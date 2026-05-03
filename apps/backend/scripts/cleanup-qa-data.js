/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL não encontrada. Execute no ambiente correto ou carregue a URL do banco antes de rodar a limpeza QA."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const APPLY_FLAG = "--apply";
const CONFIRM_ENV_VALUE = "DELETE_QA_DATA";

function isApplyMode() {
  return process.argv.includes(APPLY_FLAG);
}

function isQaStoreName(name) {
  return /^QA\s+/i.test(name.trim());
}

function isQaEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");

  if (!localPart || !domain) {
    return false;
  }

  return (
    /^(qa|test|smoke|cliente-smoke|client-smoke|courier-smoke|store-smoke)([._+-]|$)/.test(localPart) ||
    ["example.com", "example.org", "test.local", "qa.local", "smoke.local"].includes(domain)
  );
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

async function collectQaData() {
  const stores = await prisma.store.findMany({
    where: {
      OR: [{ name: { startsWith: "QA " } }, { name: { startsWith: "qa " } }]
    },
    select: {
      id: true,
      name: true,
      ownerUserId: true
    },
    orderBy: { createdAt: "asc" }
  });

  const safeStores = stores.filter((store) => isQaStoreName(store.name));
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "qa" } },
        { email: { startsWith: "test" } },
        { email: { startsWith: "smoke" } },
        { email: { startsWith: "cliente-smoke" } },
        { email: { startsWith: "client-smoke" } },
        { email: { startsWith: "courier-smoke" } },
        { email: { startsWith: "store-smoke" } },
        { email: { endsWith: "@example.com" } },
        { email: { endsWith: "@example.org" } },
        { email: { endsWith: "@test.local" } },
        { email: { endsWith: "@qa.local" } },
        { email: { endsWith: "@smoke.local" } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    },
    orderBy: { createdAt: "asc" }
  });

  const safeUsers = users.filter((user) => isQaEmail(user.email));
  const storeIds = safeStores.map((store) => store.id);
  const candidateUserIds = uniq([
    ...safeUsers.map((user) => user.id),
    ...safeStores.map((store) => store.ownerUserId)
  ]);
  const blockingStores = await prisma.store.findMany({
    where: {
      ownerUserId: { in: candidateUserIds },
      id: { notIn: storeIds }
    },
    select: {
      id: true,
      name: true,
      ownerUserId: true
    },
    orderBy: { createdAt: "asc" }
  });
  const blockedOwnerIds = new Set(blockingStores.map((store) => store.ownerUserId));
  const userIds = candidateUserIds.filter((userId) => !blockedOwnerIds.has(userId));

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { storeId: { in: storeIds } },
        { clientId: { in: userIds } },
        { courierId: { in: userIds } }
      ]
    },
    select: {
      id: true,
      customerName: true,
      storeId: true,
      clientId: true,
      courierId: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  const products = await prisma.product.findMany({
    where: { storeId: { in: storeIds } },
    select: {
      id: true,
      name: true,
      storeId: true
    },
    orderBy: { createdAt: "asc" }
  });

  const courierLinks = await prisma.storeCourierLink.findMany({
    where: {
      OR: [{ storeId: { in: storeIds } }, { courierId: { in: userIds } }]
    },
    select: {
      id: true,
      storeId: true,
      courierId: true,
      status: true
    },
    orderBy: { createdAt: "asc" }
  });

  const deliveryZones = await prisma.storeDeliveryZone.findMany({
    where: { storeId: { in: storeIds } },
    select: {
      id: true,
      name: true,
      district: true,
      storeId: true
    },
    orderBy: { createdAt: "asc" }
  });

  return {
    stores: safeStores,
    users: safeUsers,
    storeIds,
    userIds,
    orders,
    orderIds: orders.map((order) => order.id),
    products,
    courierLinks,
    deliveryZones,
    blockingStores
  };
}

function printSummary(data, applyMode) {
  console.log(applyMode ? "Modo: EXECUÇÃO REAL" : "Modo: DRY-RUN");
  console.log("");
  console.log("Candidatos QA encontrados:");
  console.log(`- lojas QA: ${data.stores.length}`);
  console.log(`- usuários QA/teste: ${data.users.length}`);
  console.log(`- pedidos relacionados: ${data.orders.length}`);
  console.log(`- produtos relacionados: ${data.products.length}`);
  console.log(`- vínculos relacionados: ${data.courierLinks.length}`);
  console.log(`- taxas por bairro relacionadas: ${data.deliveryZones.length}`);
  console.log(`- lojas reais bloqueando exclusão de usuários: ${data.blockingStores.length}`);
  console.log("");

  if (data.stores.length) {
    console.log("Lojas QA:");
    data.stores.forEach((store) => {
      console.log(`- ${store.id} | ${store.name}`);
    });
    console.log("");
  }

  if (data.users.length) {
    console.log("Usuários QA/teste:");
    data.users.forEach((user) => {
      console.log(`- ${user.id} | ${user.role} | ${user.email} | ${user.name}`);
    });
    console.log("");
  }

  if (data.blockingStores.length) {
    console.log("Atenção: os usuários abaixo possuem loja fora do padrão QA e não serão removidos automaticamente:");
    data.blockingStores.forEach((store) => {
      console.log(`- loja ${store.id} | ${store.name} | ownerUserId=${store.ownerUserId}`);
    });
    console.log("");
  }

  if (!applyMode) {
    console.log("Nenhum dado foi removido. Use --apply com CLEAN_QA_CONFIRM=DELETE_QA_DATA para executar.");
  }
}

async function deleteQaData(data) {
  await prisma.$transaction(async (transaction) => {
    if (data.orderIds.length) {
      await transaction.orderEvent.deleteMany({
        where: { orderId: { in: data.orderIds } }
      });
      await transaction.orderItem.deleteMany({
        where: { orderId: { in: data.orderIds } }
      });
      await transaction.order.deleteMany({
        where: { id: { in: data.orderIds } }
      });
    }

    if (data.storeIds.length || data.userIds.length) {
      await transaction.storeCourierLink.deleteMany({
        where: {
          OR: [
            { storeId: { in: data.storeIds } },
            { courierId: { in: data.userIds } }
          ]
        }
      });
    }

    if (data.storeIds.length) {
      await transaction.storeDeliveryZone.deleteMany({
        where: { storeId: { in: data.storeIds } }
      });
      await transaction.product.deleteMany({
        where: { storeId: { in: data.storeIds } }
      });
      await transaction.store.deleteMany({
        where: { id: { in: data.storeIds } }
      });
    }

    if (data.userIds.length) {
      await transaction.orderEvent.updateMany({
        where: { actorUserId: { in: data.userIds } },
        data: { actorUserId: null }
      });
      await transaction.clientAddress.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      await transaction.courierProfile.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      await transaction.authSession.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      await transaction.user.deleteMany({
        where: { id: { in: data.userIds } }
      });
    }
  });
}

async function main() {
  const applyMode = isApplyMode();
  const data = await collectQaData();

  printSummary(data, applyMode);

  if (!applyMode) {
    return;
  }

  if (process.env.CLEAN_QA_CONFIRM !== CONFIRM_ENV_VALUE) {
    throw new Error(
      `Confirmação ausente. Defina CLEAN_QA_CONFIRM=${CONFIRM_ENV_VALUE} para executar a limpeza real.`
    );
  }

  if (data.blockingStores.length) {
    throw new Error(
      "Limpeza interrompida: há usuários candidatos QA que possuem loja fora do padrão QA. Revise o dry-run antes de executar."
    );
  }

  await deleteQaData(data);
  console.log("");
  console.log("Limpeza QA concluída.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
