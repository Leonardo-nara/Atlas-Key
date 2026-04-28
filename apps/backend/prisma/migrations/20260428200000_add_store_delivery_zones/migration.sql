CREATE TABLE "store_delivery_zones" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "districtNormalized" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_delivery_zones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders" ADD COLUMN "suggestedDeliveryFee" DECIMAL(10,2);

CREATE UNIQUE INDEX "store_delivery_zones_storeId_districtNormalized_key" ON "store_delivery_zones"("storeId", "districtNormalized");

CREATE INDEX "store_delivery_zones_storeId_isActive_idx" ON "store_delivery_zones"("storeId", "isActive");

ALTER TABLE "store_delivery_zones" ADD CONSTRAINT "store_delivery_zones_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
