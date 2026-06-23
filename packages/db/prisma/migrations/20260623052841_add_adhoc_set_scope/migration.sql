-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "adhoc_set_scope" "AppliesTo" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "adhoc_set_scope" "AppliesTo" NOT NULL DEFAULT 'NONE';
