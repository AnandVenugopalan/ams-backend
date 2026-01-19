-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isAssigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_code_key" ON "QrCode"("code");
