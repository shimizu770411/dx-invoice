-- 保存時点の商品名・種類名を見積/請求の明細行に控える。
-- 表示・PDFは商品マスタの名称を直接引いているため、マスタで商品名を変えると
-- 発行済み書類の文言まで変わってしまう。これを防ぐための控え。
-- product_variant_group_id と同様、意図的にFK制約は付けない（マスタ側の変更を過去の明細行に波及させないため）。
-- 既存の書類には値が入らないため、表示側は未設定のとき商品マスタの名称にフォールバックする。

-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "product_item_name" VARCHAR(120),
ADD COLUMN     "product_variant_name" VARCHAR(120);

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "product_item_name" VARCHAR(120),
ADD COLUMN     "product_variant_name" VARCHAR(120);
