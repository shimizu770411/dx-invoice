-- AlterTable: estimate_items
ALTER TABLE "estimate_items"
  ADD COLUMN "product_row_id"         BIGINT,
  ADD COLUMN "product_row_variant_id" BIGINT,
  ADD COLUMN "calc_type"              "RowCalcType",
  ADD COLUMN "sign"                   INTEGER NOT NULL DEFAULT 1;

-- AlterTable: invoice_items
ALTER TABLE "invoice_items"
  ADD COLUMN "product_row_id"         BIGINT,
  ADD COLUMN "product_row_variant_id" BIGINT,
  ADD COLUMN "calc_type"              "RowCalcType",
  ADD COLUMN "sign"                   INTEGER NOT NULL DEFAULT 1;
