/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  STORE_A_NAME,
  STORE_B_NAME,
  assertQaStoreNames,
  generatePassword,
  printSafeContext,
  readManifest,
  requireSandboxSafety,
  writeManifest
} = require("./reports-qa-helpers");

const prisma = new PrismaClient();
const applyMode = process.argv.includes("--apply");

const IDS = {
  storeAOwner: "qa_reports_owner_a",
  storeBOwner: "qa_reports_owner_b",
  client: "qa_reports_client",
  courier: "qa_reports_courier",
  platform: "qa_reports_platform",
  storeA: "qa_reports_store_a",
  storeB: "qa_reports_store_b",
  productA1: "qa_reports_product_a_snapshot",
  productA2: "qa_reports_product_a_low",
  productA3: "qa_reports_product_a_zero",
  productA4: "qa_reports_product_a_no_control",
  productB1: "qa_reports_product_b_unique",
  productBPlus: "qa_reports_product_b_plus",
  productBMinus: "qa_reports_product_b_minus",
  productBAt: "qa_reports_product_b_at",
  productBTab: "qa_reports_product_b_tab",
  productBCr: "qa_reports_product_b_cr",
  productBLf: "qa_reports_product_b_lf",
  saleCompletedA: "qa_reports_sale_a_completed",
  saleDraftA: "qa_reports_sale_a_draft",
  saleYesterdayA: "qa_reports_sale_a_yesterday",
  saleB: "qa_reports_sale_b_999",
  orderDeliveredA: "qa_reports_order_a_delivered",
  orderCancelledA: "qa_reports_order_a_cancelled",
  cashRegisterA: "qa_reports_cash_register_a",
  cashClosedA: "qa_reports_cash_session_closed_a",
  cashOpenA: "qa_reports_cash_session_open_a"
};

async function main() {
  const context = requireSandboxSafety({ writeConfirm: applyMode });
  printSafeContext(context);
  console.log(`Modo: ${applyMode ? "APPLY" : "DRY-RUN"}`);

  const existingManifest = readManifest();
  if (existingManifest) {
    throw new Error("Manifesto QA Reports ja existe. Execute a limpeza antes de criar novo cenario.");
  }

  const existingStores = await prisma.store.findMany({
    where: { name: { in: [STORE_A_NAME, STORE_B_NAME] } },
    select: { id: true, name: true }
  });
  if (existingStores.length > 0) {
    assertQaStoreNames(existingStores);
    throw new Error(`Lojas QA Reports ja existem no banco: ${existingStores.map((store) => store.name).join(", ")}. Execute cleanup antes.`);
  }

  const passwordA = generatePassword();
  const passwordB = generatePassword();
  const passwordClient = generatePassword();
  const passwordCourier = generatePassword();
  const passwordPlatform = generatePassword();
  const manifest = buildManifest({ passwordA, passwordB, passwordClient, passwordCourier, passwordPlatform });

  console.log("Cenario a criar:");
  console.log("- QA_REPORTS_STORE_A: vendido 180, recebido 150, pendente 30, ticket medio 90");
  console.log("- QA_REPORTS_STORE_B: venda isolada 999 e textos de CSV injection");
  console.log("- Usuarios QA exclusivos para STORE_ADMIN, CLIENT, COURIER e PLATFORM_ADMIN");

  if (!applyMode) {
    console.log("Dry-run concluido. Nada foi criado.");
    console.log("Para criar: QA_REPORTS_ENV=sandbox QA_REPORTS_ALLOW_NODE_ENV_PRODUCTION=true QA_REPORTS_CONFIRM=CREATE_REPORTS_QA pnpm --filter @deliveries/backend reports:qa:seed:prod -- --apply");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const passwordHashA = await bcrypt.hash(passwordA, 10);
    const passwordHashB = await bcrypt.hash(passwordB, 10);
    const passwordHashClient = await bcrypt.hash(passwordClient, 10);
    const passwordHashCourier = await bcrypt.hash(passwordCourier, 10);
    const passwordHashPlatform = await bcrypt.hash(passwordPlatform, 10);
    const now = new Date();
    const today = atSaoPauloNoon(now);
    const yesterday = addDays(today, -1);

    await tx.user.createMany({
      data: [
        user(IDS.storeAOwner, "Operador QA Relatorios A", "qa-reports-store-a@example.test", passwordHashA, "STORE_ADMIN"),
        user(IDS.storeBOwner, "Operador QA Relatorios B", "qa-reports-store-b@example.test", passwordHashB, "STORE_ADMIN"),
        user(IDS.client, "Cliente QA Relatorios", "qa-reports-client@example.test", passwordHashClient, "CLIENT"),
        user(IDS.courier, "Motoboy QA Relatorios", "qa-reports-courier@example.test", passwordHashCourier, "COURIER"),
        user(IDS.platform, "Platform QA Relatorios", "qa-reports-platform@example.test", passwordHashPlatform, "PLATFORM_ADMIN")
      ]
    });
    await tx.courierProfile.create({ data: { userId: IDS.courier, city: "Bauru" } });
    await tx.store.createMany({
      data: [
        { id: IDS.storeA, name: STORE_A_NAME, address: "Rua QA Reports A", ownerUserId: IDS.storeAOwner, status: "ACTIVE", active: true },
        { id: IDS.storeB, name: STORE_B_NAME, address: "Rua QA Reports B", ownerUserId: IDS.storeBOwner, status: "ACTIVE", active: true }
      ]
    });
    await tx.product.createMany({
      data: [
        product(IDS.productA1, IDS.storeA, "Produto Snapshot Atualizado", "Relatorios", 999, 10, 5, true),
        product(IDS.productA2, IDS.storeA, "Produto Estoque Baixo", "Relatorios", 20, 2, 5, true),
        product(IDS.productA3, IDS.storeA, "Produto Estoque Zerado", "Relatorios", 15, 0, 1, true),
        product(IDS.productA4, IDS.storeA, "Produto Sem Controle", "Relatorios", 8, 0, 0, false),
        product(IDS.productB1, IDS.storeB, "=Produto Exclusivo Loja B", "Relatorios", 999, 10, 1, true),
        product(IDS.productBPlus, IDS.storeB, "+Produto Loja B", "Relatorios", 1, 1, 1, true),
        product(IDS.productBMinus, IDS.storeB, "-Produto Loja B", "Relatorios", 1, 1, 1, true),
        product(IDS.productBAt, IDS.storeB, "@Produto Loja B", "Relatorios", 1, 1, 1, true),
        product(IDS.productBTab, IDS.storeB, "\tProduto Loja B", "Relatorios", 1, 1, 1, true),
        product(IDS.productBCr, IDS.storeB, "\rProduto Loja B", "Relatorios", 1, 1, 1, true),
        product(IDS.productBLf, IDS.storeB, "\nProduto Loja B", "Relatorios", 1, 1, 1, true)
      ]
    });
    const formulaDraftSales = [
      ["qa_reports_sale_b_plus", "+Cliente Loja B"],
      ["qa_reports_sale_b_minus", "-Cliente Loja B"],
      ["qa_reports_sale_b_at", "@Cliente Loja B"],
      ["qa_reports_sale_b_tab", "\tCliente Loja B"],
      ["qa_reports_sale_b_cr", "\rCliente Loja B"],
      ["qa_reports_sale_b_lf", "\nCliente Loja B"]
    ];
    await tx.sale.createMany({
      data: [
        sale(IDS.saleCompletedA, IDS.storeA, IDS.storeAOwner, "Cliente QA A \"aspas\"", "COMPLETED", 100, 100, today, today, "PENDING"),
        sale(IDS.saleDraftA, IDS.storeA, IDS.storeAOwner, "Cliente QA Draft", "DRAFT", 50, 50, today, null, "PENDING"),
        sale(IDS.saleYesterdayA, IDS.storeA, IDS.storeAOwner, "Cliente QA Ontem", "COMPLETED", 60, 60, yesterday, yesterday, "PAID"),
        sale(IDS.saleB, IDS.storeB, IDS.storeBOwner, "=Cliente Loja B Exclusivo", "COMPLETED", 999, 999, today, today, "PAID"),
        ...formulaDraftSales.map(([id, name]) => sale(id, IDS.storeB, IDS.storeBOwner, name, "DRAFT", 0, 0, today, null, "PENDING"))
      ]
    });
    await tx.saleItem.createMany({
      data: [
        saleItem("qa_reports_sale_item_a_1", IDS.saleCompletedA, IDS.productA1, "Produto Snapshot Historico", 50, 2, 100),
        saleItem("qa_reports_sale_item_draft", IDS.saleDraftA, IDS.productA1, "Produto Draft Historico", 50, 1, 50),
        saleItem("qa_reports_sale_item_yesterday", IDS.saleYesterdayA, IDS.productA2, "Produto Ontem Historico", 60, 1, 60),
        saleItem("qa_reports_sale_item_b", IDS.saleB, IDS.productB1, "=Produto Loja B Snapshot", 999, 1, 999)
      ]
    });
    await tx.salePayment.createMany({
      data: [
        salePayment("qa_reports_sale_payment_cash_paid", IDS.saleCompletedA, "CASH", 70, "PAID", today),
        salePayment("qa_reports_sale_payment_card_pending", IDS.saleCompletedA, "CARD", 30, "PENDING", null),
        salePayment("qa_reports_sale_payment_draft", IDS.saleDraftA, "PIX_MANUAL", 50, "PENDING", null),
        salePayment("qa_reports_sale_payment_yesterday", IDS.saleYesterdayA, "PIX_MANUAL", 60, "PAID", yesterday),
        salePayment("qa_reports_sale_payment_b", IDS.saleB, "CASH", 999, "PAID", today)
      ]
    });
    await tx.saleEvent.createMany({
      data: [
        saleEvent("qa_reports_sale_event_completed_a", IDS.saleCompletedA, "SALE_COMPLETED", IDS.storeAOwner, "STORE_ADMIN", today),
        saleEvent("qa_reports_sale_event_yesterday_a", IDS.saleYesterdayA, "SALE_COMPLETED", IDS.storeAOwner, "STORE_ADMIN", yesterday),
        saleEvent("qa_reports_sale_event_b", IDS.saleB, "SALE_COMPLETED", IDS.storeBOwner, "STORE_ADMIN", today)
      ]
    });
    await tx.order.createMany({
      data: [
        order(IDS.orderDeliveredA, IDS.storeA, IDS.client, "Cliente QA Delivery", "DELIVERED", "CARD_ON_DELIVERY", "PAID", 80, 0, 80, today, today),
        order(IDS.orderCancelledA, IDS.storeA, IDS.client, "Cliente QA Delivery Cancelado", "CANCELLED", "PIX_MANUAL", "CANCELLED", 40, 0, 40, today, today)
      ]
    });
    await tx.orderItem.createMany({
      data: [
        orderItem("qa_reports_order_item_delivered", IDS.orderDeliveredA, IDS.productA1, "Produto Delivery Historico", 80, 1, 80),
        orderItem("qa_reports_order_item_cancelled", IDS.orderCancelledA, IDS.productA2, "Produto Delivery Cancelado", 40, 1, 40)
      ]
    });
    await tx.orderEvent.createMany({
      data: [
        orderEvent("qa_reports_order_event_delivered", IDS.orderDeliveredA, "DELIVERED", IDS.courier, "COURIER", today),
        orderEvent("qa_reports_order_event_cancelled", IDS.orderCancelledA, "CANCELLED", IDS.storeAOwner, "STORE_ADMIN", today)
      ]
    });
    await tx.cashRegister.create({ data: { id: IDS.cashRegisterA, storeId: IDS.storeA, name: "Caixa QA Relatorios", active: true } });
    await tx.cashRegisterSession.createMany({
      data: [
        cashSession(IDS.cashClosedA, IDS.cashRegisterA, IDS.storeA, IDS.storeAOwner, IDS.storeAOwner, "CLOSED", 50, 130, 125, -5, today, today),
        cashSession(IDS.cashOpenA, IDS.cashRegisterA, IDS.storeA, IDS.storeAOwner, null, "OPEN", 15, 15, null, null, today, null)
      ]
    });
    await tx.cashMovement.createMany({
      data: [
        cashMovement("qa_reports_cash_opening", IDS.cashClosedA, IDS.storeA, IDS.storeAOwner, "OPENING", 50, null, today),
        cashMovement("qa_reports_cash_sale", IDS.cashClosedA, IDS.storeA, IDS.storeAOwner, "SALE", 70, IDS.saleCompletedA, today),
        cashMovement("qa_reports_cash_in", IDS.cashClosedA, IDS.storeA, IDS.storeAOwner, "CASH_IN", 20, null, today),
        cashMovement("qa_reports_cash_out", IDS.cashClosedA, IDS.storeA, IDS.storeAOwner, "CASH_OUT", 10, null, today)
      ]
    });
    await tx.stockMovement.createMany({
      data: [
        stockMovement("qa_reports_stock_entry", IDS.storeA, IDS.productA1, IDS.storeAOwner, "PURCHASE_ENTRY", "IN", 20, 0, 20, today, null, null),
        stockMovement("qa_reports_stock_pdv", IDS.storeA, IDS.productA1, IDS.storeAOwner, "PDV_SALE", "OUT", 2, 20, 18, today, null, IDS.saleCompletedA),
        stockMovement("qa_reports_stock_reserved", IDS.storeA, IDS.productA1, IDS.client, "DELIVERY_RESERVED", "OUT", 1, 18, 17, today, IDS.orderDeliveredA, null),
        stockMovement("qa_reports_stock_release", IDS.storeA, IDS.productA1, IDS.storeAOwner, "DELIVERY_RELEASED", "IN", 1, 17, 18, today, IDS.orderCancelledA, null),
        stockMovement("qa_reports_stock_delivery_out", IDS.storeA, IDS.productA1, IDS.courier, "MANUAL_EXIT", "OUT", 1, 18, 17, today, IDS.orderDeliveredA, null),
        stockMovement("qa_reports_stock_inventory", IDS.storeA, IDS.productA2, IDS.storeAOwner, "INVENTORY_ADJUSTMENT", "IN", 2, 0, 2, today, null, null)
      ]
    });
  });

  writeManifest(manifest);
  console.log(`Seed QA Reports criado. Manifesto local: ${manifest.manifestPath}`);
  console.log(`Login Loja A: ${manifest.credentials.storeA.email}`);
  console.log(`Login Loja B: ${manifest.credentials.storeB.email}`);
  console.log("Senhas temporarias gravadas somente no manifesto gitignored.");
}

function buildManifest(passwords) {
  return {
    createdAt: new Date().toISOString(),
    manifestPath: "apps/backend/.qa-reports-manifest.json",
    apiUrl: process.env.QA_REPORTS_API_URL || "https://rotapronta-api-sandbox-production.up.railway.app/api",
    stores: {
      a: { id: IDS.storeA, name: STORE_A_NAME },
      b: { id: IDS.storeB, name: STORE_B_NAME }
    },
    credentials: {
      storeA: { email: "qa-reports-store-a@example.test", password: passwords.passwordA },
      storeB: { email: "qa-reports-store-b@example.test", password: passwords.passwordB },
      client: { email: "qa-reports-client@example.test", password: passwords.passwordClient },
      courier: { email: "qa-reports-courier@example.test", password: passwords.passwordCourier },
      platform: { email: "qa-reports-platform@example.test", password: passwords.passwordPlatform }
    },
    expected: {
      overviewA: {
        soldAmount: 180,
        paidAmount: 150,
        pendingAmount: 30,
        realizedCount: 2,
        averageTicket: 90,
        pdvSoldAmount: 100,
        deliverySoldAmount: 80,
        closedCashDifferenceAmount: -5
      },
      overviewB: {
        soldAmount: 999,
        paidAmount: 999
      }
    }
  };
}

function user(id, name, email, passwordHash, role) {
  return { id, name, email, passwordHash, phone: "14999999999", role, status: "ACTIVE", active: true };
}

function product(id, storeId, name, category, price, stockQuantity, minimumStock, stockControlEnabled) {
  return { id, storeId, name, category, price, stockQuantity, minimumStock, stockControlEnabled, available: true };
}

function sale(id, storeId, operatorUserId, customerName, status, subtotal, total, createdAt, completedAt, paymentStatus) {
  return { id, storeId, operatorUserId, customerName, status, subtotal, total, discountAmount: 0, surchargeAmount: 0, createdAt, updatedAt: createdAt, completedAt, paymentStatus };
}

function saleItem(id, saleId, productId, productNameSnapshot, unitPrice, quantity, total) {
  return { id, saleId, productId, productNameSnapshot, unitPrice, quantity, total };
}

function salePayment(id, saleId, method, amount, status, paidAt) {
  return { id, saleId, method, amount, status, paidAt };
}

function saleEvent(id, saleId, type, actorUserId, actorRole, createdAt) {
  return { id, saleId, type, actorUserId, actorRole, createdAt };
}

function order(id, storeId, clientId, customerName, status, paymentMethod, paymentStatus, subtotal, deliveryFee, total, createdAt, updatedAt) {
  return {
    id,
    storeId,
    clientId,
    customerName,
    customerPhone: "14999999999",
    customerAddress: "Rua QA Reports, 123",
    addressStreet: "Rua QA Reports",
    addressNumber: "123",
    addressDistrict: "Centro",
    addressCity: "Bauru",
    fulfillmentType: "DELIVERY",
    status,
    paymentMethod,
    paymentStatus,
    subtotal,
    deliveryFee,
    total,
    createdAt,
    updatedAt
  };
}

function orderItem(id, orderId, productId, nameSnapshot, unitPrice, quantity, totalPrice) {
  return { id, orderId, productId, nameSnapshot, unitPrice, quantity, totalPrice };
}

function orderEvent(id, orderId, type, actorUserId, actorRole, createdAt) {
  return { id, orderId, type, actorUserId, actorRole, createdAt };
}

function cashSession(id, cashRegisterId, storeId, openedByUserId, closedByUserId, status, openingAmount, expectedCashAmount, countedCashAmount, differenceAmount, openedAt, closedAt) {
  return { id, cashRegisterId, storeId, openedByUserId, closedByUserId, status, openingAmount, expectedCashAmount, countedCashAmount, differenceAmount, openedAt, closedAt };
}

function cashMovement(id, cashRegisterSessionId, storeId, userId, type, amount, saleId, createdAt) {
  return { id, cashRegisterSessionId, storeId, userId, type, amount, saleId, createdAt };
}

function stockMovement(id, storeId, productId, createdByUserId, type, direction, quantity, balanceBefore, balanceAfter, createdAt, orderId, saleId) {
  return { id, storeId, productId, createdByUserId, type, direction, quantity, balanceBefore, balanceAfter, createdAt, orderId, saleId, reason: "QA Reports" };
}

function atSaoPauloNoon(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(Number(byType.year), Number(byType.month) - 1, Number(byType.day), 15, 0, 0));
}

function addDays(value, days) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
