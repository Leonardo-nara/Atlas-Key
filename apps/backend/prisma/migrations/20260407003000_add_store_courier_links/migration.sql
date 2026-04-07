-- CreateEnum
CREATE TYPE "StoreCourierLinkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "StoreCourierLinkRequestedBy" AS ENUM ('COURIER', 'STORE_ADMIN');

-- CreateTable
CREATE TABLE "store_courier_links" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "StoreCourierLinkStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" "StoreCourierLinkRequestedBy" NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_courier_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_courier_links_courierId_storeId_key" ON "store_courier_links"("courierId", "storeId");

-- CreateIndex
CREATE INDEX "store_courier_links_storeId_status_idx" ON "store_courier_links"("storeId", "status");

-- CreateIndex
CREATE INDEX "store_courier_links_courierId_status_idx" ON "store_courier_links"("courierId", "status");

-- AddForeignKey
ALTER TABLE "store_courier_links" ADD CONSTRAINT "store_courier_links_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_courier_links" ADD CONSTRAINT "store_courier_links_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
