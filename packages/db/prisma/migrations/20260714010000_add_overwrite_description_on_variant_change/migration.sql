-- AlterTable
ALTER TABLE "product_items" ADD COLUMN     "overwrite_description_on_variant_change" BOOLEAN NOT NULL DEFAULT false;
