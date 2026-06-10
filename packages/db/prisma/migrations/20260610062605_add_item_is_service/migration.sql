-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "is_service" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "is_service" BOOLEAN NOT NULL DEFAULT false;
