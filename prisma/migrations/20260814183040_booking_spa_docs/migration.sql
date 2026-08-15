-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bookingTerms" TEXT,
ADD COLUMN     "spaTerms" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "bookingSnapshot" JSONB,
ADD COLUMN     "bookingStartDate" TIMESTAMP(3),
ADD COLUMN     "clientAddress" TEXT,
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientIdNumber" TEXT,
ADD COLUMN     "clientIdType" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "paymentProofAssetId" TEXT;
