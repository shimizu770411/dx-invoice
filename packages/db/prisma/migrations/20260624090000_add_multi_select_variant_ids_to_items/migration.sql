-- 複数選択パターン: 合算行の選択バリアントID一覧を保持（JSON配列文字列）
ALTER TABLE "estimate_items" ADD COLUMN "multi_select_variant_ids" TEXT;
ALTER TABLE "invoice_items"  ADD COLUMN "multi_select_variant_ids" TEXT;
