-- CreateEnum
CREATE TYPE "RowCalcType" AS ENUM ('FIXED', 'UNIT_PRICE_X_QTY');

-- AlterTable
ALTER TABLE "product_items" ADD COLUMN "is_multi_row" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_rows" (
    "id" BIGSERIAL NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "calc_type" "RowCalcType" NOT NULL DEFAULT 'UNIT_PRICE_X_QTY',
    "default_qty" INTEGER NOT NULL DEFAULT 1,
    "sign" INTEGER NOT NULL DEFAULT 1,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_row_variants" (
    "id" BIGSERIAL NOT NULL,
    "product_row_id" BIGINT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "unit_price" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_row_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_rows_product_item_id_sort_no_idx" ON "product_rows"("product_item_id", "sort_no");

-- CreateIndex
CREATE INDEX "product_row_variants_product_row_id_sort_no_idx" ON "product_row_variants"("product_row_id", "sort_no");

-- AddForeignKey
ALTER TABLE "product_rows" ADD CONSTRAINT "product_rows_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_row_variants" ADD CONSTRAINT "product_row_variants_product_row_id_fkey" FOREIGN KEY ("product_row_id") REFERENCES "product_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
