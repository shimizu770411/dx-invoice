-- グループ商品（重箱など）のMULTI選択グループ: 出力方法（合算1行/種類別複数行）を設定可能にする
-- AlterTable
ALTER TABLE "product_variant_groups" ADD COLUMN "merge_display" BOOLEAN NOT NULL DEFAULT true;
