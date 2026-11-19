-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "chainPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_chainPaymentId_key" ON "Transaction"("userId", "chainPaymentId");

