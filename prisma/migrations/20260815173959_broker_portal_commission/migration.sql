-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'VP';
ALTER TYPE "Role" ADD VALUE 'SALES_DIRECTOR';
ALTER TYPE "Role" ADD VALUE 'TEAM_LEADER';
ALTER TYPE "Role" ADD VALUE 'BROKER';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "brokerReleaseThreshold" DECIMAL(6,3) NOT NULL DEFAULT 20,
ADD COLUMN     "defaultBrokerCommission" DECIMAL(6,3),
ADD COLUMN     "defaultRmCommission" DECIMAL(6,3);

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "rmCommissionRate" DECIMAL(6,3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "brokerCommission" DECIMAL(6,3),
ADD COLUMN     "brokerReleaseThreshold" DECIMAL(6,3),
ADD COLUMN     "rmCommission" DECIMAL(6,3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brokerageId" TEXT,
ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "brokerageId" TEXT,
    "requestedById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preferredAt" TIMESTAMP(3),
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_companyId_idx" ON "Meeting"("companyId");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brokerageId_fkey" FOREIGN KEY ("brokerageId") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_brokerageId_fkey" FOREIGN KEY ("brokerageId") REFERENCES "Brokerage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
