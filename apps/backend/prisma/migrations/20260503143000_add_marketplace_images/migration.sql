ALTER TABLE "stores"
  ADD COLUMN "profileImageKey" TEXT,
  ADD COLUMN "profileImageFileName" TEXT,
  ADD COLUMN "profileImageMimeType" TEXT,
  ADD COLUMN "profileImageSize" INTEGER,
  ADD COLUMN "profileImageUpdatedAt" TIMESTAMP(3);

ALTER TABLE "products"
  ADD COLUMN "imageKey" TEXT,
  ADD COLUMN "imageFileName" TEXT,
  ADD COLUMN "imageMimeType" TEXT,
  ADD COLUMN "imageSize" INTEGER,
  ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);

ALTER TABLE "courier_profiles"
  ADD COLUMN "profileImageKey" TEXT,
  ADD COLUMN "profileImageFileName" TEXT,
  ADD COLUMN "profileImageMimeType" TEXT,
  ADD COLUMN "profileImageSize" INTEGER,
  ADD COLUMN "profileImageUpdatedAt" TIMESTAMP(3);
