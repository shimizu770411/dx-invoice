-- AlterEnum
ALTER TYPE "PaymentTargetType" ADD VALUE 'FLOWER';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "flower_id" BIGINT;

-- CreateIndex
CREATE INDEX "payments_target_type_flower_id_idx" ON "payments"("target_type", "flower_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_flower_id_fkey" FOREIGN KEY ("flower_id") REFERENCES "flowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
