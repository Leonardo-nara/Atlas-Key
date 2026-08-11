import { BadRequestException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "checkout",
  "dashboard",
  "entregador",
  "login",
  "loja",
  "pedido",
  "pedidos",
  "platform",
  "static",
  "storefront",
  "www"
]);

type StoreLookupClient = Pick<PrismaClient, "store"> | Prisma.TransactionClient;

export function normalizeStoreSlug(value: string) {
  const slug = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug || RESERVED_SLUGS.has(slug)) {
    throw new BadRequestException("Escolha um endereco valido para a loja.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException("Escolha um endereco valido para a loja.");
  }

  return slug;
}

export async function generateUniqueStoreSlug(
  prisma: StoreLookupClient,
  storeName: string
) {
  const baseSlug = normalizeStoreSlug(storeName);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await prisma.store.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new BadRequestException("Nao foi possivel gerar um endereco unico para a loja.");
}
