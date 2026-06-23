-- AlterTable
ALTER TABLE "estimate_items_free" ADD COLUMN     "parent_product_item_id" BIGINT;

-- AlterTable
ALTER TABLE "invoice_items_free" ADD COLUMN     "parent_product_item_id" BIGINT;

-- AlterTable
ALTER TABLE "product_items" ADD COLUMN     "can_add_free_row" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "estimate_items_free" ADD CONSTRAINT "estimate_items_free_parent_product_item_id_fkey" FOREIGN KEY ("parent_product_item_id") REFERENCES "product_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items_free" ADD CONSTRAINT "invoice_items_free_parent_product_item_id_fkey" FOREIGN KEY ("parent_product_item_id") REFERENCES "product_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
