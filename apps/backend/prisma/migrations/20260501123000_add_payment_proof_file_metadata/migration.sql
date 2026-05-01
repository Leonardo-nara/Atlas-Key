ALTER TABLE "orders"
ADD COLUMN "paymentProofFilePath" TEXT,
ADD COLUMN "paymentProofFileName" TEXT,
ADD COLUMN "paymentProofFileMimeType" TEXT,
ADD COLUMN "paymentProofFileSize" INTEGER,
ADD COLUMN "paymentProofUploadedAt" TIMESTAMP(3);
