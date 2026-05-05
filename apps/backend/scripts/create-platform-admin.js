const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function requiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} nao configurado`);
  }

  return value.trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const email = requiredEnv("PLATFORM_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("PLATFORM_ADMIN_PASSWORD");
  const name = requiredEnv("PLATFORM_ADMIN_NAME");
  const phone = process.env.PLATFORM_ADMIN_PHONE?.trim() ?? "";

  if (!validateEmail(email)) {
    throw new Error("PLATFORM_ADMIN_EMAIL invalido");
  }

  if (password.length < 10 || password.length > 64) {
    throw new Error("PLATFORM_ADMIN_PASSWORD deve ter entre 10 e 64 caracteres");
  }

  if (name.length < 2 || name.length > 120) {
    throw new Error("PLATFORM_ADMIN_NAME deve ter entre 2 e 120 caracteres");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      active: true
    }
  });

  if (existingUser) {
    if (existingUser.role !== "PLATFORM_ADMIN") {
      throw new Error(
        `Ja existe um usuario com o email ${email}, mas ele nao e PLATFORM_ADMIN`
      );
    }

    console.log(`PLATFORM_ADMIN ja existe: ${existingUser.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      role: "PLATFORM_ADMIN",
      status: "ACTIVE",
      active: true
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      active: true
    }
  });

  console.log(`PLATFORM_ADMIN criado: ${createdUser.email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
