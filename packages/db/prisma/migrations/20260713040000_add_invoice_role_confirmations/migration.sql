-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "approver_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "approver_confirmed_by_id" BIGINT,
ADD COLUMN     "clerk_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "clerk_confirmed_by_id" BIGINT,
ADD COLUMN     "staff_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "staff_confirmed_by_id" BIGINT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_staff_confirmed_by_id_fkey" FOREIGN KEY ("staff_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clerk_confirmed_by_id_fkey" FOREIGN KEY ("clerk_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approver_confirmed_by_id_fkey" FOREIGN KEY ("approver_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
