-- 複数選択パターン対応: 複数バリアントの同時選択可否と出力方法をProductItemに追加
ALTER TABLE "product_items" ADD COLUMN "is_multi_select" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_items" ADD COLUMN "multi_select_merge" BOOLEAN NOT NULL DEFAULT true;
