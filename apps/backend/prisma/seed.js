const bcrypt = require("bcryptjs");
const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("StrongPass123", 10);

  const storeAdmin = await prisma.user.upsert({
    where: { email: "store-admin@example.com" },
    update: {
      name: "Loja Teste",
      phone: "11999999999",
      role: "STORE_ADMIN",
      active: true,
      passwordHash
    },
    create: {
      name: "Loja Teste",
      email: "store-admin@example.com",
      phone: "11999999999",
      role: "STORE_ADMIN",
      active: true,
      passwordHash
    }
  });

  const courierOne = await prisma.user.upsert({
    where: { email: "courier@example.com" },
    update: {
      name: "Motoboy QA 1",
      phone: "11988888881",
      role: "COURIER",
      active: true,
      passwordHash
    },
    create: {
      name: "Motoboy QA 1",
      email: "courier@example.com",
      phone: "11988888881",
      role: "COURIER",
      active: true,
      passwordHash
    }
  });

  const courierTwo = await prisma.user.upsert({
    where: { email: "courier2@example.com" },
    update: {
      name: "Motoboy QA 2",
      phone: "11988888882",
      role: "COURIER",
      active: true,
      passwordHash
    },
    create: {
      name: "Motoboy QA 2",
      email: "courier2@example.com",
      phone: "11988888882",
      role: "COURIER",
      active: true,
      passwordHash
    }
  });

  const store = await prisma.store.upsert({
    where: { ownerUserId: storeAdmin.id },
    update: {
      name: "Mercado Central",
      address: "Rua das Flores, 123",
      active: true
    },
    create: {
      name: "Mercado Central",
      address: "Rua das Flores, 123",
      ownerUserId: storeAdmin.id,
      active: true
    }
  });

  await prisma.order.deleteMany({
    where: {
      storeId: store.id,
      notes: {
        startsWith: "[seed]"
      }
    }
  });

  await prisma.product.deleteMany({
    where: {
      storeId: store.id,
      category: "QA Seed"
    }
  });

  const products = await prisma.product.createManyAndReturn({
    data: [
      {
        storeId: store.id,
        name: "Hamburguer Classico",
        description: "Pao, carne e queijo",
        price: new Prisma.Decimal(24.9),
        category: "QA Seed",
        available: true
      },
      {
        storeId: store.id,
        name: "Batata Grande",
        description: "Porcao de batata crocante",
        price: new Prisma.Decimal(14.5),
        category: "QA Seed",
        available: true
      },
      {
        storeId: store.id,
        name: "Refrigerante Lata",
        description: "Lata 350ml",
        price: new Prisma.Decimal(6.5),
        category: "QA Seed",
        available: true
      }
    ]
  });

  const [burger, fries, soda] = products;

  await createSeedOrder({
    storeId: store.id,
    notes: "[seed] Pedido pendente para aceite",
    customerName: "Cliente Pendente",
    customerPhone: "11977770001",
    customerAddress: "Rua Um, 100",
    courierId: null,
    status: "PENDING",
    actorByStatus: {
      CREATED: storeAdmin
    },
    items: [
      { product: burger, quantity: 1 },
      { product: fries, quantity: 1 }
    ]
  });

  await createSeedOrder({
    storeId: store.id,
    notes: "[seed] Pedido aceito pelo courier 1",
    customerName: "Cliente Aceito",
    customerPhone: "11977770002",
    customerAddress: "Rua Dois, 200",
    courierId: courierOne.id,
    status: "ACCEPTED",
    actorByStatus: {
      CREATED: storeAdmin,
      ACCEPTED: courierOne
    },
    items: [
      { product: burger, quantity: 2 },
      { product: soda, quantity: 2 }
    ]
  });

  await createSeedOrder({
    storeId: store.id,
    notes: "[seed] Pedido em rota pelo courier 1",
    customerName: "Cliente Em Rota",
    customerPhone: "11977770003",
    customerAddress: "Rua Tres, 300",
    courierId: courierOne.id,
    status: "OUT_FOR_DELIVERY",
    actorByStatus: {
      CREATED: storeAdmin,
      ACCEPTED: courierOne,
      OUT_FOR_DELIVERY: courierOne
    },
    items: [
      { product: burger, quantity: 1 },
      { product: fries, quantity: 2 },
      { product: soda, quantity: 1 }
    ]
  });

  await createSeedOrder({
    storeId: store.id,
    notes: "[seed] Pedido entregue pelo courier 2",
    customerName: "Cliente Entregue",
    customerPhone: "11977770004",
    customerAddress: "Rua Quatro, 400",
    courierId: courierTwo.id,
    status: "DELIVERED",
    actorByStatus: {
      CREATED: storeAdmin,
      ACCEPTED: courierTwo,
      OUT_FOR_DELIVERY: courierTwo,
      DELIVERED: courierTwo
    },
    items: [
      { product: burger, quantity: 1 },
      { product: soda, quantity: 1 }
    ]
  });

  await createSeedOrder({
    storeId: store.id,
    notes: "[seed] Pedido cancelado pela loja",
    customerName: "Cliente Cancelado",
    customerPhone: "11977770005",
    customerAddress: "Rua Cinco, 500",
    courierId: courierTwo.id,
    status: "CANCELLED",
    cancelReason: "Cliente pediu para alterar o endereco",
    items: [
      { product: fries, quantity: 1 },
      { product: soda, quantity: 2 }
    ],
    actorByStatus: {
      CREATED: storeAdmin,
      ACCEPTED: courierTwo,
      CANCELLED: storeAdmin
    }
  });

  console.log("Seed concluido com sucesso.");
  console.log("STORE_ADMIN: store-admin@example.com / StrongPass123");
  console.log("COURIER 1: courier@example.com / StrongPass123");
  console.log("COURIER 2: courier2@example.com / StrongPass123");
}

async function createSeedOrder({
  storeId,
  notes,
  customerName,
  customerPhone,
  customerAddress,
  courierId,
  status,
  items,
  cancelReason,
  actorByStatus = {}
}) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const deliveryFee = 8;
  const total = subtotal + deliveryFee;

  const order = await prisma.order.create({
    data: {
      storeId,
      courierId,
      customerName,
      customerPhone,
      customerAddress,
      subtotal: new Prisma.Decimal(subtotal),
      deliveryFee: new Prisma.Decimal(deliveryFee),
      total: new Prisma.Decimal(total),
      status,
      cancelReason: cancelReason ?? null,
      notes,
      items: {
        create: items.map((item) => ({
          productId: item.product.id,
          nameSnapshot: item.product.name,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.product.price),
          totalPrice: new Prisma.Decimal(
            Number(item.product.price) * item.quantity
          )
        }))
      }
    }
  });

  const events = [
    {
      type: "CREATED",
      actor: actorByStatus.CREATED
    }
  ];

  if (["ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(status)) {
    events.push({
      type: "ACCEPTED",
      actor: actorByStatus.ACCEPTED
    });
  }

  if (["OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) {
    events.push({
      type: "PICKED_UP",
      actor: actorByStatus.OUT_FOR_DELIVERY ?? actorByStatus.PICKED_UP
    });
  }

  if (status === "DELIVERED") {
    events.push({
      type: "DELIVERED",
      actor: actorByStatus.DELIVERED
    });
  }

  if (status === "CANCELLED") {
    events.push({
      type: "CANCELLED",
      actor: actorByStatus.CANCELLED,
      metadata: cancelReason ? { reason: cancelReason } : undefined
    });
  }

  await prisma.orderEvent.createMany({
    data: events.map((event) => ({
      orderId: order.id,
      type: event.type,
      actorUserId: event.actor?.id ?? null,
      actorRole: event.actor?.role ?? null,
      metadata: event.metadata ?? undefined
    }))
  });

  return order;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
