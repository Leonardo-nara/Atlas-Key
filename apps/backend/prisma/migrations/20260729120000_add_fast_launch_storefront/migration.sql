-- Fast Launch MVP: public storefront configuration and guest order tracking.

CREATE TYPE "OrderOrigin" AS ENUM ('DESKTOP', 'MOBILE_CLIENT', 'STOREFRONT');

ALTER TABLE "stores"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "storefrontEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "businessHoursNote" TEXT,
  ADD COLUMN "averagePreparationMinutes" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN "deliveryTimeMinMinutes" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "deliveryTimeMaxMinutes" INTEGER NOT NULL DEFAULT 45;

ALTER TABLE "orders"
  ADD COLUMN "origin" "OrderOrigin" NOT NULL DEFAULT 'DESKTOP',
  ADD COLUMN "publicTrackingToken" TEXT,
  ADD COLUMN "publicOrderCode" TEXT,
  ADD COLUMN "storefrontRequestId" TEXT,
  ADD COLUMN "addressZipCode" TEXT,
  ADD COLUMN "addressState" TEXT;

CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE UNIQUE INDEX "orders_publicTrackingToken_key" ON "orders"("publicTrackingToken");
CREATE UNIQUE INDEX "orders_storeId_storefrontRequestId_key" ON "orders"("storeId", "storefrontRequestId");
CREATE INDEX "orders_origin_createdAt_idx" ON "orders"("origin", "createdAt");
CREATE INDEX "orders_publicOrderCode_idx" ON "orders"("publicOrderCode");
