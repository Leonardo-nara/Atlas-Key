CREATE TYPE "StockMovementDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL', 'PURCHASE_ENTRY', 'MANUAL_ENTRY', 'MANUAL_EXIT', 'INVENTORY_ADJUSTMENT', 'PDV_SALE', 'DELIVERY_RESERVED', 'DELIVERY_RELEASED', 'RETURN', 'CORRECTION');

ALTER TABLE "products"
ADD COLUMN "stockControlEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN "minimumStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stockUpdatedAt" TIMESTAMP(3);

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "type" "StockMovementType" NOT NULL,
  "direction" "StockMovementDirection" NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "balanceBefore" DECIMAL(14,3) NOT NULL,
  "balanceAfter" DECIMAL(14,3) NOT NULL,
  "reason" TEXT,
  "orderId" TEXT,
  "saleId" TEXT,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_movements_orderId_productId_type_key" ON "stock_movements"("orderId", "productId", "type");
CREATE UNIQUE INDEX "stock_movements_saleId_productId_type_key" ON "stock_movements"("saleId", "productId", "type");
CREATE INDEX "stock_movements_storeId_createdAt_idx" ON "stock_movements"("storeId", "createdAt");
CREATE INDEX "stock_movements_storeId_type_createdAt_idx" ON "stock_movements"("storeId", "type", "createdAt");
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
