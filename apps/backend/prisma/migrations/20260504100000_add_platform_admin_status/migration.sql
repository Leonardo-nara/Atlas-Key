ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "stores" ADD COLUMN "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "users" SET "status" = 'INACTIVE' WHERE "active" = false;
UPDATE "stores" SET "status" = 'INACTIVE' WHERE "active" = false;

CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "stores_status_idx" ON "stores"("status");
