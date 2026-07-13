-- 重箱パターン: 見積/請求明細行がどのグループ(基本セット/追加オプション)由来かを保持
-- product_row_id と同様、意図的にFK制約は付けない（グループ定義変更後も過去の明細行表示に影響させないため）
-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN "product_variant_group_id" BIGINT;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN "product_variant_group_id" BIGINT;
