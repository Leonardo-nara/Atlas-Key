ALTER TABLE "users"
ADD COLUMN "googleSub" TEXT,
ADD COLUMN "googleEmailVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");
