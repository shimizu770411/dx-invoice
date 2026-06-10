-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "sort_no" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_variants_product_item_id_sort_no_idx" ON "product_variants"("product_item_id", "sort_no");
