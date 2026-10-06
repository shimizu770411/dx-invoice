-- AlterTable
ALTER TABLE "estimate_items_free" ADD COLUMN     "unit_price_member" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invoice_items_free" ADD COLUMN     "unit_price_member" INTEGER NOT NULL DEFAULT 0;

-- 既存行は価格が1つしかなかったため、会員価格にも同じ額を入れて表示・金額を変えない
UPDATE "estimate_items_free" SET "unit_price_member" = "unit_price_general";
UPDATE "invoice_items_free" SET "unit_price_member" = "unit_price_general";
