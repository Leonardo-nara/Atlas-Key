/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL nao encontrada. Execute no ambiente correto ou carregue a URL do banco antes de rodar a limpeza QA."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const APPLY_FLAG = "--apply";
const CONFIRM_ENV_VALUE = "DELETE_QA_DATA";
const exactQaPrefixes = (process.env.CLEAN_QA_EXACT_PREFIXES ?? "")
  .split(",")
  .map((prefix) => prefix.trim().toLowerCase())
  .filter(Boolean);
const safeTargetText = [
  process.env.DATABASE_URL,
  process.env.RAILWAY_PROJECT_NAME,
  process.env.RAILWAY_SERVICE_NAME,
  process.env.RAILWAY_ENVIRONMENT_NAME,
  process.env.RAILWAY_PUBLIC_DOMAIN,
  process.env.RAILWAY_STATIC_URL,
  process.env.CLEAN_QA_DATABASE_LABEL
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

function isApplyMode() {
  return process.argv.includes(APPLY_FLAG);
}

function hasExactQaPrefix(value) {
  const normalizedValue = value.trim().toLowerCase();

  return exactQaPrefixes.some((prefix) => normalizedValue.includes(prefix));
}

function isSafeCleanupTarget() {
  return /\b(sandbox|test|e2e)\b/.test(safeTargetText);
}

function assertSafeApplyTarget() {
  if (!exactQaPrefixes.length) {
    throw new Error(
      "Limpeza real bloqueada. Defina CLEAN_QA_EXACT_PREFIXES com o prefixo exato do teste, por exemplo qa-pdv-1783796838726."
    );
  }

  if (!isSafeCleanupTarget()) {
    throw new Error(
      "Limpeza real bloqueada. O alvo precisa indicar sandbox/test/e2e em DATABASE_URL, variaveis Railway ou CLEAN_QA_DATABASE_LABEL=sandbox."
    );
  }
}

function getSafeStoreWhere() {
  const qaNamePatterns = [
    { name: { startsWith: "QA " } },
    { name: { startsWith: "qa " } },
    { name: { startsWith: "QA-" } },
    { name: { startsWith: "qa-" } },
    { name: { startsWith: "QA_" } },
    { name: { startsWith: "qa_" } }
  ];

  if (exactQaPrefixes.length === 0) {
    return { OR: qaNamePatterns };
  }

  return {
    OR: exactQaPrefixes.flatMap((prefix) => [
      { name: { contains: prefix, mode: "insensitive" } },
      { owner: { email: { contains: prefix, mode: "insensitive" } } }
    ])
  };
}

function getSafeUserWhere() {
  const qaEmailPatterns = [
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
  ];

  if (exactQaPrefixes.length === 0) {
    return { OR: qaEmailPatterns };
  }

  return {
    OR: exactQaPrefixes.flatMap((prefix) => [
      { email: { contains: prefix, mode: "insensitive" } },
      { name: { contains: prefix, mode: "insensitive" } }
    ])
  };
}

function isQaStoreName(name) {
  if (exactQaPrefixes.length > 0) {
    return hasExactQaPrefix(name);
  }

  return /^qa[\s_-]/i.test(name.trim());
}

function isQaEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (exactQaPrefixes.length > 0) {
    return hasExactQaPrefix(normalizedEmail);
  }

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
    where: getSafeStoreWhere(),
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      owner: {
        select: {
          email: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const safeStores = stores.filter((store) => {
    return isQaStoreName(store.name) || (store.owner?.email ? isQaEmail(store.owner.email) : false);
  });
  const users = await prisma.user.findMany({
    where: getSafeUserWhere(),
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
  const removableUsers = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const blockedUsers = safeUsers.filter((user) => blockedOwnerIds.has(user.id));

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

  const sales = await prisma.sale.findMany({
    where: {
      OR: [
        { storeId: { in: storeIds } },
        { operatorUserId: { in: userIds } },
        ...(exactQaPrefixes.length
          ? exactQaPrefixes.map((prefix) => ({
              notes: { contains: prefix, mode: "insensitive" }
            }))
          : [])
      ]
    },
    select: {
      id: true,
      storeId: true,
      operatorUserId: true,
      customerName: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });
  const saleIds = sales.map((sale) => sale.id);
  const saleItems = saleIds.length
    ? await prisma.saleItem.findMany({
        where: { saleId: { in: saleIds } },
        select: {
          id: true,
          saleId: true,
          productNameSnapshot: true,
          quantity: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const salePayments = saleIds.length
    ? await prisma.salePayment.findMany({
        where: { saleId: { in: saleIds } },
        select: {
          id: true,
          saleId: true,
          method: true,
          amount: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const saleEvents = saleIds.length
    ? await prisma.saleEvent.findMany({
        where: { saleId: { in: saleIds } },
        select: {
          id: true,
          saleId: true,
          type: true,
          createdAt: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const authSessions = userIds.length
    ? await prisma.authSession.findMany({
        where: { userId: { in: userIds } },
        select: {
          id: true,
          userId: true,
          createdAt: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const cashRegisters = storeIds.length
    ? await prisma.cashRegister.findMany({
        where: { storeId: { in: storeIds } },
        select: {
          id: true,
          storeId: true,
          name: true,
          active: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const cashRegisterIds = cashRegisters.map((cashRegister) => cashRegister.id);
  const cashRegisterSessions = storeIds.length || cashRegisterIds.length
    ? await prisma.cashRegisterSession.findMany({
        where: {
          OR: [
            { storeId: { in: storeIds } },
            { cashRegisterId: { in: cashRegisterIds } }
          ]
        },
        select: {
          id: true,
          cashRegisterId: true,
          storeId: true,
          status: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const cashRegisterSessionIds = cashRegisterSessions.map((session) => session.id);
  const cashMovements = storeIds.length || userIds.length || cashRegisterSessionIds.length
    ? await prisma.cashMovement.findMany({
        where: {
          OR: [
            { storeId: { in: storeIds } },
            { userId: { in: userIds } },
            { cashRegisterSessionId: { in: cashRegisterSessionIds } }
          ]
        },
        select: {
          id: true,
          cashRegisterSessionId: true,
          storeId: true,
          userId: true,
          type: true
        },
        orderBy: { createdAt: "asc" }
      })
    : [];

  return {
    stores: safeStores,
    users: removableUsers,
    blockedUsers,
    storeIds,
    userIds,
    orders,
    orderIds: orders.map((order) => order.id),
    products,
    courierLinks,
    deliveryZones,
    sales,
    saleIds,
    saleItems,
    salePayments,
    saleEvents,
    authSessions,
    cashRegisters,
    cashRegisterIds,
    cashRegisterSessions,
    cashRegisterSessionIds,
    cashMovements,
    blockingStores
  };
}

function printSummary(data, applyMode) {
  console.log(applyMode ? "Modo: EXECUCAO REAL" : "Modo: DRY-RUN");
  console.log("");
  console.log("Candidatos QA encontrados:");
  if (exactQaPrefixes.length) {
    console.log(`- prefixos exatos: ${exactQaPrefixes.join(", ")}`);
  }
  console.log(`- lojas QA: ${data.stores.length}`);
  console.log(`- usuarios que serao removidos: ${data.users.length}`);
  console.log(`- pedidos relacionados: ${data.orders.length}`);
  console.log(`- produtos relacionados: ${data.products.length}`);
  console.log(`- vendas PDV relacionadas: ${data.sales.length}`);
  console.log(`- itens de venda PDV relacionados: ${data.saleItems.length}`);
  console.log(`- pagamentos de venda PDV relacionados: ${data.salePayments.length}`);
  console.log(`- eventos de venda PDV relacionados: ${data.saleEvents.length}`);
  console.log(`- caixas relacionados: ${data.cashRegisters.length}`);
  console.log(`- sessoes de caixa relacionadas: ${data.cashRegisterSessions.length}`);
  console.log(`- movimentos de caixa relacionados: ${data.cashMovements.length}`);
  console.log(`- vinculos relacionados: ${data.courierLinks.length}`);
  console.log(`- taxas por bairro relacionadas: ${data.deliveryZones.length}`);
  console.log(`- sessoes relacionadas: ${data.authSessions.length}`);
  console.log(`- lojas bloqueadas para revisao manual: ${data.blockingStores.length}`);
  console.log("");

  if (data.stores.length) {
    console.log("Lojas que serao removidas:");
    data.stores.forEach((store) => {
      console.log(`- ${store.id} | ${store.name}`);
    });
    console.log("");
  }

  if (data.users.length) {
    console.log("Usuarios que serao removidos:");
    data.users.forEach((user) => {
      console.log(`- ${user.id} | ${user.role} | ${user.email} | ${user.name}`);
    });
    console.log("");
  }

  if (data.products.length) {
    console.log("Produtos que serao removidos:");
    data.products.forEach((product) => {
      console.log(`- ${product.id} | storeId=${product.storeId} | ${product.name}`);
    });
    console.log("");
  }

  if (data.sales.length) {
    console.log("Vendas PDV que serao removidas:");
    data.sales.forEach((sale) => {
      console.log(
        `- ${sale.id} | storeId=${sale.storeId} | operador=${sale.operatorUserId} | status=${sale.status} | cliente=${sale.customerName ?? "sem cliente"}`
      );
    });
    console.log("");
  }

  if (data.cashRegisters.length) {
    console.log("Caixas que serao removidos:");
    data.cashRegisters.forEach((cashRegister) => {
      console.log(`- ${cashRegister.id} | storeId=${cashRegister.storeId} | ${cashRegister.name}`);
    });
    console.log("");
  }

  if (data.blockingStores.length) {
    console.log("Lojas bloqueadas para revisao manual:");
    data.blockingStores.forEach((store) => {
      console.log(`- loja ${store.id} | ${store.name} | ownerUserId=${store.ownerUserId}`);
    });
    console.log("");
  }

  if (data.blockedUsers.length) {
    console.log("Usuarios QA/teste bloqueados por possuirem loja fora do padrao QA:");
    data.blockedUsers.forEach((user) => {
      console.log(`- ${user.id} | ${user.role} | ${user.email} | ${user.name}`);
    });
    console.log("");
  }

  if (!applyMode) {
    console.log(
      "Nenhum dado foi removido. Use --apply com CLEAN_QA_CONFIRM=DELETE_QA_DATA para executar."
    );
  }
}

async function deleteQaData(data) {
  const removedCounts = {
    orderEvents: 0,
    orderItems: 0,
    orders: 0,
    saleEvents: 0,
    saleItems: 0,
    salePayments: 0,
    sales: 0,
    cashMovements: 0,
    cashRegisterSessions: 0,
    cashRegisters: 0,
    courierLinks: 0,
    deliveryZones: 0,
    products: 0,
    stores: 0,
    clientAddresses: 0,
    courierProfiles: 0,
    authSessions: 0,
    users: 0
  };

  await prisma.$transaction(async (transaction) => {
    if (data.orderIds.length) {
      const orderEvents = await transaction.orderEvent.deleteMany({
        where: { orderId: { in: data.orderIds } }
      });
      const orderItems = await transaction.orderItem.deleteMany({
        where: { orderId: { in: data.orderIds } }
      });
      const orders = await transaction.order.deleteMany({
        where: { id: { in: data.orderIds } }
      });
      removedCounts.orderEvents += orderEvents.count;
      removedCounts.orderItems += orderItems.count;
      removedCounts.orders += orders.count;
    }

    if (data.storeIds.length || data.userIds.length) {
      const courierLinks = await transaction.storeCourierLink.deleteMany({
        where: {
          OR: [
            { storeId: { in: data.storeIds } },
            { courierId: { in: data.userIds } }
          ]
        }
      });
      removedCounts.courierLinks += courierLinks.count;
    }

    if (data.saleIds.length) {
      const saleEvents = await transaction.saleEvent.deleteMany({
        where: { saleId: { in: data.saleIds } }
      });
      const salePayments = await transaction.salePayment.deleteMany({
        where: { saleId: { in: data.saleIds } }
      });
      const saleItems = await transaction.saleItem.deleteMany({
        where: { saleId: { in: data.saleIds } }
      });
      const sales = await transaction.sale.deleteMany({
        where: { id: { in: data.saleIds } }
      });
      removedCounts.saleEvents += saleEvents.count;
      removedCounts.salePayments += salePayments.count;
      removedCounts.saleItems += saleItems.count;
      removedCounts.sales += sales.count;
    }

    if (data.cashMovements.length) {
      const cashMovements = await transaction.cashMovement.deleteMany({
        where: { id: { in: data.cashMovements.map((movement) => movement.id) } }
      });
      removedCounts.cashMovements += cashMovements.count;
    }

    if (data.cashRegisterSessionIds.length) {
      const cashRegisterSessions = await transaction.cashRegisterSession.deleteMany({
        where: { id: { in: data.cashRegisterSessionIds } }
      });
      removedCounts.cashRegisterSessions += cashRegisterSessions.count;
    }

    if (data.cashRegisterIds.length) {
      const cashRegisters = await transaction.cashRegister.deleteMany({
        where: { id: { in: data.cashRegisterIds } }
      });
      removedCounts.cashRegisters += cashRegisters.count;
    }

    if (data.storeIds.length) {
      const deliveryZones = await transaction.storeDeliveryZone.deleteMany({
        where: { storeId: { in: data.storeIds } }
      });
      const products = await transaction.product.deleteMany({
        where: { storeId: { in: data.storeIds } }
      });
      const stores = await transaction.store.deleteMany({
        where: { id: { in: data.storeIds } }
      });
      removedCounts.deliveryZones += deliveryZones.count;
      removedCounts.products += products.count;
      removedCounts.stores += stores.count;
    }

    if (data.userIds.length) {
      await transaction.orderEvent.updateMany({
        where: { actorUserId: { in: data.userIds } },
        data: { actorUserId: null }
      });
      const clientAddresses = await transaction.clientAddress.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      const courierProfiles = await transaction.courierProfile.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      const authSessions = await transaction.authSession.deleteMany({
        where: { userId: { in: data.userIds } }
      });
      const users = await transaction.user.deleteMany({
        where: { id: { in: data.userIds } }
      });
      removedCounts.clientAddresses += clientAddresses.count;
      removedCounts.courierProfiles += courierProfiles.count;
      removedCounts.authSessions += authSessions.count;
      removedCounts.users += users.count;
    }
  });

  return removedCounts;
}

function printApplyResult(data, removedCounts) {
  console.log("");
  console.log("Limpeza QA concluida.");
  console.log("Dados removidos:");
  console.log(`- lojas: ${removedCounts.stores}`);
  console.log(`- usuarios: ${removedCounts.users}`);
  console.log(`- pedidos: ${removedCounts.orders}`);
  console.log(`- itens de pedido: ${removedCounts.orderItems}`);
  console.log(`- eventos de pedido: ${removedCounts.orderEvents}`);
  console.log(`- vendas PDV: ${removedCounts.sales}`);
  console.log(`- itens de venda PDV: ${removedCounts.saleItems}`);
  console.log(`- pagamentos de venda PDV: ${removedCounts.salePayments}`);
  console.log(`- eventos de venda PDV: ${removedCounts.saleEvents}`);
  console.log(`- movimentos de caixa: ${removedCounts.cashMovements}`);
  console.log(`- sessoes de caixa: ${removedCounts.cashRegisterSessions}`);
  console.log(`- caixas: ${removedCounts.cashRegisters}`);
  console.log(`- produtos: ${removedCounts.products}`);
  console.log(`- vinculos: ${removedCounts.courierLinks}`);
  console.log(`- taxas por bairro: ${removedCounts.deliveryZones}`);
  console.log(`- enderecos de cliente: ${removedCounts.clientAddresses}`);
  console.log(`- perfis de motoboy: ${removedCounts.courierProfiles}`);
  console.log(`- sessoes: ${removedCounts.authSessions}`);

  if (data.blockingStores.length) {
    console.log("");
    console.log("Lojas que permaneceram bloqueadas para revisao manual:");
    data.blockingStores.forEach((store) => {
      console.log(`- loja ${store.id} | ${store.name} | ownerUserId=${store.ownerUserId}`);
    });
  }
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
      `Confirmacao ausente. Defina CLEAN_QA_CONFIRM=${CONFIRM_ENV_VALUE} para executar a limpeza real.`
    );
  }

  assertSafeApplyTarget();

  const removedCounts = await deleteQaData(data);
  printApplyResult(data, removedCounts);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
