-- 重箱等「基本セット(単一選択)+追加オプション(複数選択)」パターン対応
-- 既存の is_multi_select / multi_select_merge とは独立した新パターン
-- CreateEnum
CREATE TYPE "ProductVariantGroupSelectionType" AS ENUM ('SINGLE', 'MULTI');

-- AlterTable
ALTER TABLE "product_items" ADD COLUMN "has_variant_groups" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_variant_groups" (
    "id" BIGSERIAL NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "selection_type" "ProductVariantGroupSelectionType" NOT NULL DEFAULT 'SINGLE',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_variant_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "group_id" BIGINT;

-- CreateIndex
CREATE INDEX "product_variant_groups_product_item_id_sort_no_idx" ON "product_variant_groups"("product_item_id", "sort_no");

-- CreateIndex
CREATE INDEX "product_variants_group_id_sort_no_idx" ON "product_variants"("group_id", "sort_no");

-- AddForeignKey
ALTER TABLE "product_variant_groups" ADD CONSTRAINT "product_variant_groups_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_variant_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
