import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { StoreStatus } from "@prisma/client";

import { UserRole } from "../src/common/enums/user-role.enum";
import { StoresService } from "../src/stores/stores.service";

interface ReadinessScenario {
  store?: StoreScenario;
  activeProducts?: number;
  activeProductsWithValidPrice?: number;
  activeControlledProducts?: number;
  activeControlledProductsWithInvalidStock?: number;
  activeControlledOutOfStockProducts?: number;
  activeControlledLowStockProducts?: number;
  activeDeliveryZones?: number;
  deliveryZonesWithInvalidFee?: number;
  activeCouriers?: number;
  activeCashRegisters?: number;
  completedSales?: number;
  deliveredOrders?: number;
  productsWithImage?: number;
}

interface StoreScenario {
  id: string;
  name: string;
  address: string;
  ownerUserId: string;
  active: boolean;
  status: StoreStatus;
  profileImageKey: string | null;
  pixEnabled: boolean;
  pixKeyType: "CPF" | null;
  pixKey: string | null;
  pixRecipientName: string | null;
}

describe("stores readiness service", () => {
  it("retorna contrato estavel para loja vazia", async () => {
    const { service } = createStoresService({});
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.ready, false);
    assert.equal(readiness.percentage, 67);
    assert.equal(readiness.completedRequiredItems, 2);
    assert.equal(readiness.totalRequiredItems, 3);
    assert.equal(readiness.completedItems, 4);
    assert.equal(readiness.totalItems, 11);
    assert.equal(readiness.items.every((item) => item.label && item.category && item.route), true);
  });

  it("considera pronta com todos os obrigatorios completos mesmo com recomendados pendentes", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.ready, true);
    assert.equal(readiness.percentage, 100);
    assert.equal(getItem(readiness, "DELIVERY_ZONES").completed, false);
    assert.equal(getItem(readiness, "CASH_REGISTER").completed, false);
  });

  it("calcula porcentagem obrigatoria parcial e geral separadamente", async () => {
    const { service } = createStoresService({
      store: { ...baseStore, address: "" },
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      activeDeliveryZones: 1,
      activeCashRegisters: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.ready, false);
    assert.equal(readiness.percentage, 67);
    assert.notEqual(readiness.overallPercentage, readiness.percentage);
  });

  it("retorna cem por cento quando todos os obrigatorios estao completos", async () => {
    const { service } = createStoresService({
      activeProducts: 3,
      activeProductsWithValidPrice: 3
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.percentage, 100);
    assert.equal(readiness.completedRequiredItems, readiness.totalRequiredItems);
  });

  it("produto ativo com preco valido satisfaz requisito de catalogo", async () => {
    const { service } = createStoresService({
      activeProducts: 2,
      activeProductsWithValidPrice: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "ACTIVE_PRODUCT_WITH_VALID_PRICE").completed, true);
  });

  it("produto inativo ou com preco zero nao satisfaz requisito de catalogo", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 0
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "ACTIVE_PRODUCT_WITH_VALID_PRICE").completed, false);
    assert.equal(readiness.ready, false);
  });

  it("produto de outra loja nao entra porque todas as consultas usam storeId da loja autenticada", async () => {
    const { service, queries } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1
    });
    await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(queries.every((query) => query.where?.storeId === "store-a" || !("where" in query)), true);
  });

  it("estoque sem controle nao bloqueia prontidao", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      activeControlledProducts: 0
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "STOCK_CONFIGURED").completed, true);
    assert.equal(readiness.ready, true);
  });

  it("estoque controlado configurado fica recomendado como completo", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      activeControlledProducts: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "STOCK_CONFIGURED").completed, true);
  });

  it("estoque zerado gera alerta recomendado sem bloquear obrigatorios", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      activeControlledProducts: 1,
      activeControlledOutOfStockProducts: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "STOCK_CONFIGURED").completed, true);
    assert.match(getItem(readiness, "STOCK_CONFIGURED").description, /sem estoque/i);
    assert.equal(readiness.ready, true);
  });

  it("taxa ativa e nao negativa satisfaz recomendacao de entrega", async () => {
    const { service } = createStoresService({
      activeDeliveryZones: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "DELIVERY_ZONES").completed, true);
  });

  it("taxa negativa ou zona de outra loja nao satisfaz recomendacao", async () => {
    const { service } = createStoresService({
      activeDeliveryZones: 1,
      deliveryZonesWithInvalidFee: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "DELIVERY_ZONES").completed, false);
  });

  it("dinheiro e cartao na entrega satisfazem forma operacional sem exigir online", async () => {
    const { service } = createStoresService({});
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "PAYMENT_METHOD_AVAILABLE").completed, true);
    assert.equal(readiness.items.some((item) => item.key.includes("ONLINE")), false);
  });

  it("Pix manual desabilitado nao exige chave", async () => {
    const { service } = createStoresService({
      store: { ...baseStore, pixEnabled: false, pixKey: null, pixRecipientName: null }
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "PIX_MANUAL").completed, true);
    assert.equal(getItem(readiness, "PIX_MANUAL").category, "RECOMMENDED");
  });

  it("Pix manual habilitado completo satisfaz recomendacao", async () => {
    const { service } = createStoresService({
      store: {
        ...baseStore,
        pixEnabled: true,
        pixKeyType: "CPF",
        pixKey: "12345678900",
        pixRecipientName: "Loja A"
      }
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "PIX_MANUAL").completed, true);
  });

  it("Pix manual habilitado incompleto nao bloqueia prontidao quando metodos basicos existem", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      store: {
        ...baseStore,
        pixEnabled: true,
        pixKeyType: "CPF",
        pixKey: null,
        pixRecipientName: "Loja A"
      }
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "PIX_MANUAL").completed, false);
    assert.equal(readiness.ready, true);
  });

  it("caixa e motoboy sao recomendados e nao abrem ou criam registros automaticamente", async () => {
    const { service, mutations } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "CASH_REGISTER").category, "RECOMMENDED");
    assert.equal(getItem(readiness, "LINKED_COURIER").category, "RECOMMENDED");
    assert.deepEqual(mutations, []);
    assert.equal(readiness.ready, true);
  });

  it("ausencia de imagens nao bloqueia prontidao", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      productsWithImage: 0
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "STORE_IMAGE").category, "OPTIONAL");
    assert.equal(getItem(readiness, "PRODUCT_IMAGES").category, "OPTIONAL");
    assert.equal(readiness.ready, true);
  });

  it("operacao testada e somente recomendacao", async () => {
    const { service } = createStoresService({
      activeProducts: 1,
      activeProductsWithValidPrice: 1,
      completedSales: 0,
      deliveredOrders: 0
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(getItem(readiness, "TEST_OPERATION").category, "RECOMMENDED");
    assert.equal(getItem(readiness, "TEST_OPERATION").completed, false);
    assert.equal(readiness.ready, true);
  });

  it("mantem endpoint restrito ao STORE_ADMIN", async () => {
    const { service } = createStoresService({});

    await assert.rejects(
      () => service.getReadiness("client-a", UserRole.CLIENT),
      ForbiddenException
    );
  });

  it("usa poucas consultas agregadas e nao carrega produtos completos", async () => {
    const { service, queries } = createStoresService({});
    await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(queries.length, 13);
    assert.equal(queries.every((query) => query.operation === "count"), true);
  });
});

const baseStore: StoreScenario = {
  id: "store-a",
  name: "Loja A",
  address: "Rua A, 123",
  ownerUserId: "owner-a",
  active: true,
  status: StoreStatus.ACTIVE,
  profileImageKey: null,
  pixEnabled: false,
  pixKeyType: null,
  pixKey: null,
  pixRecipientName: null
};

function createStoresService(scenario: ReadinessScenario) {
  const data = {
    activeProducts: 0,
    activeProductsWithValidPrice: 0,
    activeControlledProducts: 0,
    activeControlledProductsWithInvalidStock: 0,
    activeControlledOutOfStockProducts: 0,
    activeControlledLowStockProducts: 0,
    activeDeliveryZones: 0,
    deliveryZonesWithInvalidFee: 0,
    activeCouriers: 0,
    activeCashRegisters: 0,
    completedSales: 0,
    deliveredOrders: 0,
    productsWithImage: 0,
    ...scenario
  };
  const store = data.store ?? baseStore;
  const queries: Array<{ operation: string; where?: Record<string, unknown> }> = [];
  const mutations: string[] = [];
  const countResults = [
    data.activeProducts,
    data.activeProductsWithValidPrice,
    data.activeControlledProducts,
    data.activeControlledProductsWithInvalidStock,
    data.activeControlledOutOfStockProducts,
    data.activeControlledLowStockProducts,
    data.activeDeliveryZones,
    data.deliveryZonesWithInvalidFee,
    data.activeCouriers,
    data.activeCashRegisters,
    data.completedSales,
    data.deliveredOrders,
    data.productsWithImage
  ];

  function count(args: { where?: Record<string, unknown> }) {
    queries.push({ operation: "count", where: args.where });
    return Promise.resolve(countResults.shift() ?? 0);
  }

  function mutate(operation: string) {
    mutations.push(operation);
    throw new Error(`Mutacao inesperada: ${operation}`);
  }

  const prisma = {
    store: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        where.ownerUserId === store.ownerUserId ? store : null,
      create: () => mutate("store.create"),
      update: () => mutate("store.update"),
      delete: () => mutate("store.delete")
    },
    product: {
      count,
      fields: {
        minimumStock: "minimumStock"
      },
      create: () => mutate("product.create"),
      update: () => mutate("product.update"),
      delete: () => mutate("product.delete")
    },
    storeDeliveryZone: { count },
    storeCourierLink: { count },
    cashRegister: {
      count,
      create: () => mutate("cashRegister.create"),
      update: () => mutate("cashRegister.update")
    },
    sale: {
      count,
      create: () => mutate("sale.create"),
      update: () => mutate("sale.update")
    },
    order: {
      count,
      create: () => mutate("order.create"),
      update: () => mutate("order.update")
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
  };

  return {
    service: new StoresService(prisma as never, {} as never),
    queries,
    mutations
  };
}

function getItem(
  readiness: Awaited<ReturnType<StoresService["getReadiness"]>>,
  key: string
) {
  const item = readiness.items.find((entry) => entry.key === key);
  assert.ok(item, `Item ${key} deveria existir`);
  return item;
}
