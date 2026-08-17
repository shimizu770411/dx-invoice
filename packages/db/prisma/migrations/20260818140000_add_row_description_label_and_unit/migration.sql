-- AlterTable
ALTER TABLE "product_rows" ADD COLUMN "use_for_description_label" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_row_variants" ADD COLUMN "unit_label" VARCHAR(8);
