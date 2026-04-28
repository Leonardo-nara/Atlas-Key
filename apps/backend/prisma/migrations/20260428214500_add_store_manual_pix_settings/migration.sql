CREATE TYPE "StorePixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM_KEY');

ALTER TABLE "stores"
ADD COLUMN "pixKeyType" "StorePixKeyType",
ADD COLUMN "pixKey" TEXT,
ADD COLUMN "pixRecipientName" TEXT,
ADD COLUMN "pixInstructions" TEXT,
ADD COLUMN "pixEnabled" BOOLEAN NOT NULL DEFAULT false;
