-- AlterTable
ALTER TABLE "product_items" ADD COLUMN     "sort_no" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_items_sort_no_idx" ON "product_items"("sort_no");
