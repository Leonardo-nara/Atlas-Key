const { PrismaClient, Prisma } = require("@prisma/client");

const { assertNoSensitiveKeys, getArg } = require("./pilot-script-helpers");

const prisma = new PrismaClient();

function decimalToNumber(value) {
  return value instanceof Prisma.Decimal ? Number(value) : value;
}

async function main() {
  const storeId = getArg("store-id") || process.env.PILOT_STORE_ID?.trim();
  const json = process.argv.includes("--json");

  if (!storeId) {
    throw new Error("Informe --store-id=<id> ou PILOT_STORE_ID");
  }

  const now = new Date();
  const staleOpenSessionDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      status: true,
      active: true,
      owner: { select: { id: true, email: true, status: true, active: true } }
    }
  });

  if (!store) {
    throw new Error("Loja nao encontrada");
  }

  const [
    activeUsers,
    recentSessions,
    ordersByStatus,
    salesByStatus,
    pendingOrderPayments,
    pendingSalePayments,
    openCashSessions,
    staleCashSessions,
    lowStock,
    outOfStock,
    readinessCounts
  ] = await prisma.$transaction([
    prisma.user.count({ where: { id: store.owner.id, active: true, status: "ACTIVE" } }),
    prisma.authSession.count({
      where: {
        userId: store.owner.id,
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.order.groupBy({ by: ["status"], where: { storeId }, _count: { _all: true } }),
    prisma.sale.groupBy({ by: ["status"], where: { storeId }, _count: { _all: true } }),
    prisma.order.count({ where: { storeId, paymentStatus: "PENDING" } }),
    prisma.sale.count({ where: { storeId, paymentStatus: "PENDING" } }),
    prisma.cashRegisterSession.count({ where: { storeId, status: "OPEN" } }),
    prisma.cashRegisterSession.count({ where: { storeId, status: "OPEN", openedAt: { lt: staleOpenSessionDate } } }),
    prisma.product.count({
      where: {
        storeId,
        stockControlEnabled: true,
        AND: [
          { stockQuantity: { gt: new Prisma.Decimal(0) } },
          { stockQuantity: { lte: prisma.product.fields.minimumStock } }
        ]
      }
    }),
    prisma.product.count({
      where: { storeId, stockControlEnabled: true, stockQuantity: { lte: new Prisma.Decimal(0) } }
    }),
    prisma.product.aggregate({
      where: { storeId, active: true },
      _count: { _all: true }
    })
  ]);

  const summary = {
    generatedAt: now.toISOString(),
    store,
    activeUsers,
    recentSessions,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((item) => [item.status, item._count._all])),
    salesByStatus: Object.fromEntries(salesByStatus.map((item) => [item.status, item._count._all])),
    pendingPayments: {
      orders: pendingOrderPayments,
      sales: pendingSalePayments
    },
    cash: {
      openSessions: openCashSessions,
      staleOpenSessions: staleCashSessions
    },
    stock: {
      lowStockProducts: lowStock,
      outOfStockProducts: outOfStock
    },
    readiness: {
      activeProducts: readinessCounts._count._all,
      reportsAvailable: true
    },
    alerts: [
      ...(store.status !== "ACTIVE" || !store.active ? ["Loja nao esta ativa"] : []),
      ...(staleCashSessions > 0 ? ["Ha caixa aberto ha mais de 12 horas"] : []),
      ...(outOfStock > 0 ? ["Ha produtos sem estoque"] : []),
      ...(lowStock > 0 ? ["Ha produtos com estoque baixo"] : [])
    ]
  };

  assertNoSensitiveKeys(summary);

  if (json) {
    console.log(JSON.stringify(summary, (_, value) => decimalToNumber(value), 2));
    return;
  }

  console.log(`Loja: ${store.name} (${store.status})`);
  console.log(`Usuarios ativos: ${activeUsers}`);
  console.log(`Sessoes recentes: ${recentSessions}`);
  console.log(`Pedidos por status: ${JSON.stringify(summary.ordersByStatus)}`);
  console.log(`Vendas PDV por status: ${JSON.stringify(summary.salesByStatus)}`);
  console.log(`Pagamentos pendentes: pedidos=${pendingOrderPayments}, vendas=${pendingSalePayments}`);
  console.log(`Caixas abertos: ${openCashSessions} (${staleCashSessions} acima de 12h)`);
  console.log(`Estoque baixo: ${lowStock}; sem estoque: ${outOfStock}`);
  console.log(`Alertas: ${summary.alerts.length ? summary.alerts.join("; ") : "nenhum alerta critico"}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
