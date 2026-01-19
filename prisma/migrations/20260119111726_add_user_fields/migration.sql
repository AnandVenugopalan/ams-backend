-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "designation" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Update existing records with default values
UPDATE "User" SET "fullName" = username WHERE "fullName" IS NULL;
UPDATE "User" SET "email" = username || '@example.com' WHERE "email" IS NULL;

-- Make fields NOT NULL
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
