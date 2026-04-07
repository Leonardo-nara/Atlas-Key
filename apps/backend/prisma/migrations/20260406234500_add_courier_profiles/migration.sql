-- CreateEnum
CREATE TYPE "CourierVehicleType" AS ENUM ('MOTO', 'SCOOTER', 'BICICLETA', 'CARRO');

-- CreateTable
CREATE TABLE "courier_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profilePhotoUrl" TEXT,
  "vehiclePhotoUrl" TEXT,
  "vehicleType" "CourierVehicleType",
  "vehicleModel" TEXT,
  "plate" TEXT,
  "city" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "courier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_profiles_userId_key" ON "courier_profiles"("userId");

-- CreateIndex
CREATE INDEX "courier_profiles_city_idx" ON "courier_profiles"("city");

-- CreateIndex
CREATE INDEX "courier_profiles_vehicleType_idx" ON "courier_profiles"("vehicleType");

-- AddForeignKey
ALTER TABLE "courier_profiles" ADD CONSTRAINT "courier_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
