import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateUniqueStoreSlug,
  normalizeStoreSlug
} from "../src/stores/store-slug";

describe("store slug helpers", () => {
  it("normaliza nome publico da loja removendo acentos e caracteres invalidos", () => {
    assert.equal(normalizeStoreSlug("  Açaí do João!  "), "acai-do-joao");
    assert.equal(normalizeStoreSlug("Pizzaria Central 24h"), "pizzaria-central-24h");
  });

  it("bloqueia slug reservado ou vazio", () => {
    assert.throws(() => normalizeStoreSlug("api"), /endereco valido/);
    assert.throws(() => normalizeStoreSlug("!!!"), /endereco valido/);
  });

  it("gera sufixo quando o slug base ja existe", async () => {
    const existing = new Set(["ilha-lanches", "ilha-lanches-2"]);
    const prisma = {
      store: {
        findUnique: async ({ where }: { where: { slug: string } }) =>
          existing.has(where.slug) ? { id: where.slug } : null
      }
    };

    await assert.doesNotReject(async () => {
      const slug = await generateUniqueStoreSlug(prisma as never, "Ilha Lanches");
      assert.equal(slug, "ilha-lanches-3");
    });
  });
});
