import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { StoreStatus } from "@prisma/client";

import { UserRole } from "../src/common/enums/user-role.enum";
import { StoresService } from "../src/stores/stores.service";

interface ReadinessScenario {
  store?: {
    id: string;
    name: string;
    address: string;
    ownerUserId: string;
    active: boolean;
    status: StoreStatus;
    profileImageKey?: string | null;
    pixEnabled?: boolean;
    pixKeyType?: "CPF" | null;
    pixKey?: string | null;
    pixRecipientName?: string | null;
  };
  activeProducts?: number;
  productsWithoutValidPrice?: number;
  activeControlledProducts?: number;
  activeControlledProductsWithInvalidStock?: number;
  activeDeliveryZones?: number;
  activeCouriers?: number;
  activeCashRegisters?: number;
  completedSales?: number;
  deliveredOrders?: number;
  productsWithImage?: number;
}

describe("stores readiness service", () => {
  it("retorna loja vazia como nao pronta e sem expor dados sensiveis", async () => {
    const service = createStoresService({});
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.ready, false);
    assert.equal(readiness.requiredCompletedItems < readiness.requiredTotalItems, true);
    assert.equal(readiness.items.some((item) => item.key === "active-product" && !item.completed), true);
    assert.equal(JSON.stringify(readiness).includes("pixKey"), false);
  });

  it("considera pronta quando todos os itens obrigatorios estao completos", async () => {
    const service = createStoresService({
      activeProducts: 3,
      activeControlledProducts: 1,
      activeDeliveryZones: 2,
      activeCashRegisters: 1,
      activeCouriers: 1,
      completedSales: 1,
      productsWithImage: 2,
      store: {
        ...baseStore,
        profileImageKey: "stores/store-a/image.webp",
        pixEnabled: true,
        pixKeyType: "CPF",
        pixKey: "12345678900",
        pixRecipientName: "Loja A"
      }
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);

    assert.equal(readiness.ready, true);
    assert.equal(readiness.requiredCompletedItems, readiness.requiredTotalItems);
    assert.equal(readiness.items.find((item) => item.key === "pix-manual")?.completed, true);
  });

  it("bloqueia prontidao quando Pix manual esta habilitado sem configuracao completa", async () => {
    const service = createStoresService({
      activeProducts: 1,
      activeDeliveryZones: 1,
      activeCashRegisters: 1,
      store: {
        ...baseStore,
        pixEnabled: true,
        pixKeyType: "CPF",
        pixKey: null,
        pixRecipientName: "Loja A"
      }
    });
    const readiness = await service.getReadiness("owner-a", UserRole.STORE_ADMIN);
    const pixItem = readiness.items.find((item) => item.key === "pix-manual");

    assert.equal(readiness.ready, false);
    assert.equal(pixItem?.category, "REQUIRED");
    assert.equal(pixItem?.completed, false);
  });

  it("mantem endpoint restrito ao STORE_ADMIN", async () => {
    const service = createStoresService({});

    await assert.rejects(
      () => service.getReadiness("client-a", UserRole.CLIENT),
      ForbiddenException
    );
  });
});

const baseStore = {
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
    productsWithoutValidPrice: 0,
    activeControlledProducts: 0,
    activeControlledProductsWithInvalidStock: 0,
    activeDeliveryZones: 0,
    activeCouriers: 0,
    activeCashRegisters: 0,
    completedSales: 0,
    deliveredOrders: 0,
    productsWithImage: 0,
    ...scenario
  };
  const store = data.store ?? baseStore;

  const prisma = {
    store: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        where.ownerUserId === store.ownerUserId ? store : null
    },
    product: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        if ("price" in where) {
          return data.productsWithoutValidPrice;
        }

        if ("OR" in where) {
          return data.activeControlledProductsWithInvalidStock;
        }

        if (where.stockControlEnabled === true) {
          return data.activeControlledProducts;
        }

        if ("imageKey" in where) {
          return data.productsWithImage;
        }

        return data.activeProducts;
      }
    },
    storeDeliveryZone: {
      count: async () => data.activeDeliveryZones
    },
    storeCourierLink: {
      count: async () => data.activeCouriers
    },
    cashRegister: {
      count: async () => data.activeCashRegisters
    },
    sale: {
      count: async () => data.completedSales
    },
    order: {
      count: async () => data.deliveredOrders
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
  };

  return new StoresService(prisma as never, {} as never);
}
