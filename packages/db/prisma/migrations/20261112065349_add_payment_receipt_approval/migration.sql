-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "receipt_approved_at" TIMESTAMPTZ(6),
ADD COLUMN     "receipt_approved_by_id" BIGINT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_approved_by_id_fkey" FOREIGN KEY ("receipt_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
