-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DUE', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "EoiStatus" AS ENUM ('SUBMITTED', 'ALLOCATED', 'CONVERTED', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Brokerage" ADD COLUMN     "agreementRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionRate" DECIMAL(6,3);

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "commissionRate" DECIMAL(6,3),
ADD COLUMN     "commissionStatus" TEXT NOT NULL DEFAULT 'accrued',
ADD COLUMN     "handoverStatus" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN     "oqoodDate" TIMESTAMP(3),
ADD COLUMN     "oqoodRef" TEXT,
ADD COLUMN     "oqoodStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "titleDeedRef" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "escrowAccountNo" TEXT,
ADD COLUMN     "escrowBank" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'installment',
    "dueDate" TIMESTAMP(3),
    "percent" DECIMAL(6,3),
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "reference" TEXT,
    "toEscrow" BOOLEAN NOT NULL DEFAULT true,
    "status" "PaymentStatus" NOT NULL DEFAULT 'DUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eoi" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientIdNumber" TEXT,
    "tokenAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "EoiStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Payment_offerId_idx" ON "Payment"("offerId");

-- CreateIndex
CREATE INDEX "Payment_companyId_status_idx" ON "Payment"("companyId", "status");

-- CreateIndex
CREATE INDEX "Eoi_companyId_idx" ON "Eoi"("companyId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eoi" ADD CONSTRAINT "Eoi_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eoi" ADD CONSTRAINT "Eoi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
