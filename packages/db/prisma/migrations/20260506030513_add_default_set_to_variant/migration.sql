-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "is_default_set" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "set_price" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_variants_product_item_id_is_default_set_idx" ON "product_variants"("product_item_id", "is_default_set");
