-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'RESOLVED');

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING';
