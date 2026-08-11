ALTER TABLE "stores"
ADD COLUMN "publicName" TEXT,
ADD COLUMN "publicPhone" TEXT,
ADD COLUMN "addressComplement" TEXT,
ADD COLUMN "addressCity" TEXT,
ADD COLUMN "addressState" TEXT,
ADD COLUMN "addressZipCode" TEXT,
ADD COLUMN "storefrontMinimumOrder" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "storefrontPaymentMethods" JSONB,
ADD COLUMN "storefrontOpeningHours" JSONB;

ALTER TABLE "products"
ADD COLUMN "showInStorefront" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "storefrontFeatured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "orders"
ADD COLUMN "storefrontPaymentLabel" TEXT,
ADD COLUMN "cashChangeNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cashChangeFor" DECIMAL(10,2);

ALTER TABLE "order_items"
ADD COLUMN "notes" TEXT;

CREATE INDEX "products_storeId_showInStorefront_available_idx" ON "products"("storeId", "showInStorefront", "available");
