-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "pdf_show_free_item_qty" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pdf_show_free_item_unit_price" BOOLEAN NOT NULL DEFAULT true;
