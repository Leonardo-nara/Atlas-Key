/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  STORE_EMPTY_NAME,
  STORE_OTHER_NAME,
  STORE_PARTIAL_NAME,
  STORE_READY_NAME,
  assertQaStoreNames,
  generatePassword,
  printSafeContext,
  readManifest,
  requireSandboxSafety,
  writeManifest
} = require("./readiness-qa-helpers");

const prisma = new PrismaClient();
const applyMode = process.argv.includes("--apply");

const IDS = {
  emptyOwner: "qa_readiness_owner_empty",
  partialOwner: "qa_readiness_owner_partial",
  readyOwner: "qa_readiness_owner_ready",
  otherOwner: "qa_readiness_owner_other",
  client: "qa_readiness_client",
  courier: "qa_readiness_courier",
  platform: "qa_readiness_platform",
  emptyStore: "qa_readiness_store_empty",
  partialStore: "qa_readiness_store_partial",
  readyStore: "qa_readiness_store_ready",
  otherStore: "qa_readiness_store_other",
  partialProduct: "qa_readiness_product_partial_zero",
  readyProduct: "qa_readiness_product_ready",
  otherProduct: "qa_readiness_product_other",
  readyZone: "qa_readiness_zone_ready"
};

async function main() {
  const context = requireSandboxSafety({ writeConfirm: applyMode });
  printSafeContext(context);
  console.log(`Modo: ${applyMode ? "APPLY" : "DRY-RUN"}`);

  if (readManifest()) {
    throw new Error("Manifesto QA Readiness ja existe. Execute a limpeza antes de criar novo cenario.");
  }

  const existingStores = await prisma.store.findMany({
    where: { name: { in: [STORE_EMPTY_NAME, STORE_PARTIAL_NAME, STORE_READY_NAME, STORE_OTHER_NAME] } },
    select: { id: true, name: true }
  });
  if (existingStores.length > 0) {
    assertQaStoreNames(existingStores);
    throw new Error(`Lojas QA Readiness ja existem: ${existingStores.map((store) => store.name).join(", ")}.`);
  }

  const passwords = {
    empty: generatePassword(),
    partial: generatePassword(),
    ready: generatePassword(),
    other: generatePassword(),
    client: generatePassword(),
    courier: generatePassword(),
    platform: generatePassword()
  };
  const manifest = buildManifest(passwords);

  console.log("Cenario a criar:");
  console.log("- QA_READINESS_STORE_EMPTY: sem produtos, ready=false, percentage=67");
  console.log("- QA_READINESS_STORE_PARTIAL: produto sem preco valido, ready=false, percentage=67");
  console.log("- QA_READINESS_STORE_READY: obrigatorios completos, ready=true, percentage=100");
  console.log("- QA_READINESS_STORE_OTHER: loja isolada para teste de storeId externo");

  if (!applyMode) {
    console.log("Dry-run concluido. Nada foi criado.");
    console.log("Para criar: QA_READINESS_ENV=sandbox QA_READINESS_ALLOW_NODE_ENV_PRODUCTION=true QA_READINESS_CONFIRM=CREATE_READINESS_QA pnpm --filter @deliveries/backend readiness:qa:seed:prod -- --apply");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const hashes = Object.fromEntries(
      await Promise.all(
        Object.entries(passwords).map(async ([key, password]) => [key, await bcrypt.hash(password, 10)])
      )
    );

    await tx.user.createMany({
      data: [
        user(IDS.emptyOwner, "QA Readiness Vazia", "qa-readiness-empty@example.test", hashes.empty, "STORE_ADMIN"),
        user(IDS.partialOwner, "QA Readiness Parcial", "qa-readiness-partial@example.test", hashes.partial, "STORE_ADMIN"),
        user(IDS.readyOwner, "QA Readiness Pronta", "qa-readiness-ready@example.test", hashes.ready, "STORE_ADMIN"),
        user(IDS.otherOwner, "QA Readiness Outra", "qa-readiness-other@example.test", hashes.other, "STORE_ADMIN"),
        user(IDS.client, "Cliente QA Readiness", "qa-readiness-client@example.test", hashes.client, "CLIENT"),
        user(IDS.courier, "Motoboy QA Readiness", "qa-readiness-courier@example.test", hashes.courier, "COURIER"),
        user(IDS.platform, "Platform QA Readiness", "qa-readiness-platform@example.test", hashes.platform, "PLATFORM_ADMIN")
      ]
    });
    await tx.courierProfile.create({ data: { userId: IDS.courier, city: "Bauru" } });
    await tx.store.createMany({
      data: [
        store(IDS.emptyStore, STORE_EMPTY_NAME, IDS.emptyOwner),
        store(IDS.partialStore, STORE_PARTIAL_NAME, IDS.partialOwner),
        store(IDS.readyStore, STORE_READY_NAME, IDS.readyOwner),
        store(IDS.otherStore, STORE_OTHER_NAME, IDS.otherOwner)
      ]
    });
    await tx.product.createMany({
      data: [
        product(IDS.partialProduct, IDS.partialStore, "Produto QA sem preco", 0),
        product(IDS.readyProduct, IDS.readyStore, "Produto QA pronto", 25),
        product(IDS.otherProduct, IDS.otherStore, "Produto QA outra loja", 99)
      ]
    });
    await tx.storeDeliveryZone.create({
      data: {
        id: IDS.readyZone,
        storeId: IDS.readyStore,
        name: "Centro",
        district: "Centro",
        districtNormalized: "centro",
        fee: 5,
        isActive: true
      }
    });
  });

  writeManifest(manifest);
  console.log(`Seed QA Readiness criado. Manifesto local: ${manifest.manifestPath}`);
  console.log("Senhas temporarias gravadas somente no manifesto gitignored.");
}

function buildManifest(passwords) {
  return {
    manifestPath: "apps/backend/.qa-readiness-manifest.json",
    ids: IDS,
    credentials: {
      empty: { email: "qa-readiness-empty@example.test", password: passwords.empty },
      partial: { email: "qa-readiness-partial@example.test", password: passwords.partial },
      ready: { email: "qa-readiness-ready@example.test", password: passwords.ready },
      other: { email: "qa-readiness-other@example.test", password: passwords.other },
      client: { email: "qa-readiness-client@example.test", password: passwords.client },
      courier: { email: "qa-readiness-courier@example.test", password: passwords.courier },
      platform: { email: "qa-readiness-platform@example.test", password: passwords.platform }
    },
    expected: {
      empty: { ready: false, percentage: 67 },
      partial: { ready: false, percentage: 67 },
      ready: { ready: true, percentage: 100 },
      other: { ready: true, percentage: 100 }
    },
    createdAt: new Date().toISOString()
  };
}

function user(id, name, email, passwordHash, role) {
  return { id, name, email, passwordHash, phone: "14999999999", role, active: true, status: "ACTIVE" };
}

function store(id, name, ownerUserId) {
  return { id, name, address: `Rua ${name}`, ownerUserId, status: "ACTIVE", active: true };
}

function product(id, storeId, name, price) {
  return {
    id,
    storeId,
    name,
    description: "Produto criado apenas para QA Readiness",
    price,
    category: "QA",
    available: true,
    stockControlEnabled: false
  };
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
