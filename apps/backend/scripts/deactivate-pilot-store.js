const { PrismaClient } = require("@prisma/client");

const {
  assertNoSensitiveKeys,
  ensureProductionDeactivateGuard,
  getArg,
  isApplyMode
} = require("./pilot-script-helpers");

const prisma = new PrismaClient();

async function main() {
  const apply = isApplyMode();
  ensureProductionDeactivateGuard({ apply });

  const storeId = getArg("store-id") || process.env.PILOT_STORE_ID?.trim();
  const reason = getArg("reason") || process.env.PILOT_DEACTIVATE_REASON?.trim() || "Desativacao operacional do piloto";

  if (!storeId) {
    throw new Error("Informe --store-id=<id> ou PILOT_STORE_ID");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      status: true,
      active: true,
      ownerUserId: true,
      owner: { select: { id: true, email: true, status: true, active: true } },
      _count: {
        select: {
          orders: true,
          sales: true,
          cashRegisterSessions: true,
          stockMovements: true,
          courierLinks: true
        }
      }
    }
  });

  if (!store) {
    throw new Error("Loja nao encontrada");
  }

  const plan = {
    mode: apply ? "apply" : "dry-run",
    store: {
      id: store.id,
      name: store.name,
      status: store.status,
      active: store.active
    },
    owner: {
      id: store.owner.id,
      email: store.owner.email,
      status: store.owner.status,
      active: store.owner.active
    },
    preservedHistory: store._count,
    actions: [
      "marcar loja como INACTIVE e active=false",
      "marcar administrador como INACTIVE e active=false",
      "revogar sessoes ativas do administrador",
      "bloquear vinculos de motoboys da loja"
    ],
    reason
  };

  assertNoSensitiveKeys(plan);

  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.authSession.updateMany({
      where: { userId: store.ownerUserId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await tx.storeCourierLink.updateMany({
      where: { storeId: store.id, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "BLOCKED" }
    });
    const updatedStore = await tx.store.update({
      where: { id: store.id },
      data: { status: "INACTIVE", active: false },
      select: { id: true, name: true, status: true, active: true }
    });
    const updatedOwner = await tx.user.update({
      where: { id: store.ownerUserId },
      data: { status: "INACTIVE", active: false },
      select: { id: true, email: true, status: true, active: true }
    });

    return { updatedStore, updatedOwner };
  });

  const output = {
    deactivated: true,
    store: result.updatedStore,
    owner: result.updatedOwner,
    preservedHistory: store._count
  };
  assertNoSensitiveKeys(output);
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
