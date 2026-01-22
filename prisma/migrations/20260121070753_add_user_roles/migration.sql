-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "registeredBy" TEXT,
ALTER COLUMN "serialNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Complaint" ALTER COLUMN "description" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN "assetId" TEXT,
ADD COLUMN "registeredBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_assetId_key" ON "QrCode"("assetId");
