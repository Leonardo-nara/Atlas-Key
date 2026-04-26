CREATE TYPE "OrderFulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');

ALTER TABLE "orders"
ADD COLUMN "fulfillmentType" "OrderFulfillmentType" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN "addressStreet" TEXT,
ADD COLUMN "addressNumber" TEXT,
ADD COLUMN "addressDistrict" TEXT,
ADD COLUMN "addressComplement" TEXT,
ADD COLUMN "addressCity" TEXT,
ADD COLUMN "addressReference" TEXT,
ADD COLUMN "storeConfirmedAt" TIMESTAMP(3);
