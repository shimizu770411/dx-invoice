-- AlterTable
ALTER TABLE "product_items" ADD COLUMN     "is_set_child" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_set_parent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_sets" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT NOT NULL,
    "child_id" BIGINT NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_sets_parent_id_sort_no_idx" ON "product_sets"("parent_id", "sort_no");

-- CreateIndex
CREATE UNIQUE INDEX "product_sets_parent_id_child_id_key" ON "product_sets"("parent_id", "child_id");

-- CreateIndex
CREATE INDEX "product_items_is_set_parent_idx" ON "product_items"("is_set_parent");

-- CreateIndex
CREATE INDEX "product_items_is_set_child_idx" ON "product_items"("is_set_child");

-- AddForeignKey
ALTER TABLE "product_sets" ADD CONSTRAINT "product_sets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sets" ADD CONSTRAINT "product_sets_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
