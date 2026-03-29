-- AlterTable
ALTER TABLE "orders" ADD COLUMN "cancelReason" TEXT;

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM (
  'CREATED',
  'ACCEPTED',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "OrderEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorRole" "UserRole",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_events_actorUserId_idx" ON "order_events"("actorUserId");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
