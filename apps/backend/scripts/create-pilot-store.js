const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const {
  assertNoSensitiveKeys,
  collectPilotInput,
  ensureProductionCreateGuard,
  generateTemporaryPassword,
  isApplyMode,
  safeSummary,
  writeLocalCredentials
} = require("./pilot-script-helpers");

const prisma = new PrismaClient();

async function findExisting(input) {
  const [existingStore, existingUser] = await Promise.all([
    prisma.store.findFirst({
      where: { name: { equals: input.storeName, mode: "insensitive" } },
      select: { id: true, name: true, status: true, active: true }
    }),
    prisma.user.findUnique({
      where: { email: input.adminEmail },
      select: { id: true, email: true, role: true, status: true, active: true }
    })
  ]);

  return { existingStore, existingUser };
}

async function main() {
  const apply = isApplyMode();
  ensureProductionCreateGuard({ apply });

  const input = collectPilotInput();
  const existing = await findExisting(input);

  const plan = {
    mode: apply ? "apply" : "dry-run",
    input: safeSummary(input),
    checks: {
      storeNameAvailable: !existing.existingStore,
      adminEmailAvailable: !existing.existingUser,
      slugPersistence: input.slug ? "slug recebido, mas nao existe campo slug no schema atual" : "nao informado",
      documentPersistence: input.document ? "documento recebido, mas nao existe campo documento no schema atual" : "nao informado"
    },
    itemsToCreate: ["STORE_ADMIN", "STORE"],
    itemsNotCreated: []
  };

  if (existing.existingStore) {
    plan.itemsNotCreated.push({ type: "STORE", reason: "nome de loja ja existe", id: existing.existingStore.id });
  }

  if (existing.existingUser) {
    plan.itemsNotCreated.push({ type: "USER", reason: "email de administrador ja existe", id: existing.existingUser.id });
  }

  assertNoSensitiveKeys(plan);

  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (existing.existingStore || existing.existingUser) {
    throw new Error("Criacao interrompida: loja ou usuario ja existem");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.adminName,
        email: input.adminEmail,
        passwordHash,
        phone: input.phone,
        role: "STORE_ADMIN",
        status: "ACTIVE",
        active: true
      },
      select: { id: true, email: true, role: true, status: true, active: true }
    });

    const store = await tx.store.create({
      data: {
        name: input.storeName,
        address: input.combinedAddress,
        ownerUserId: user.id,
        status: "ACTIVE",
        active: true
      },
      select: { id: true, name: true, status: true, active: true, ownerUserId: true }
    });

    return { user, store };
  });

  const credentialsPath = writeLocalCredentials({
    createdAt: new Date().toISOString(),
    storeId: result.store.id,
    storeName: result.store.name,
    adminUserId: result.user.id,
    adminEmail: result.user.email,
    temporaryPassword,
    note: "Arquivo local ignorado pelo Git. Exigir troca de senha no primeiro acesso assim que houver suporte nativo."
  });

  const output = {
    created: true,
    storeId: result.store.id,
    adminUserId: result.user.id,
    storeName: result.store.name,
    adminEmail: result.user.email,
    status: result.store.status,
    itemsCreated: ["STORE_ADMIN", "STORE"],
    itemsNotCreated: [],
    credentialsFile: credentialsPath,
    passwordPrinted: false
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
