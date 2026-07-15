ALTER TABLE "stores"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

UPDATE "stores"
SET "timezone" = 'America/Sao_Paulo'
WHERE "timezone" IS NULL OR trim("timezone") = '';
