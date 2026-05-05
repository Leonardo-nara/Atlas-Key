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

  if (!validateEmail(email)) {
    throw new Error("PLATFORM_ADMIN_EMAIL invalido");
  }

  if (password.length < 10 || password.length > 64) {
    throw new Error("PLATFORM_ADMIN_PASSWORD deve ter entre 10 e 64 caracteres");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (!existingUser) {
    throw new Error(`PLATFORM_ADMIN nao encontrado para o email ${email}`);
  }

  if (existingUser.role !== "PLATFORM_ADMIN") {
    throw new Error(
      `Usuario ${email} existe, mas nao e PLATFORM_ADMIN. Senha nao alterada.`
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: existingUser.id },
    data: { passwordHash }
  });

  console.log(`Senha do PLATFORM_ADMIN atualizada: ${existingUser.email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
