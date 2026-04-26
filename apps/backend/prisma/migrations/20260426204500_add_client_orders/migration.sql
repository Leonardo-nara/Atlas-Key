ALTER TABLE "orders" ADD COLUMN "clientId" TEXT;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orders_clientId_idx" ON "orders"("clientId");
