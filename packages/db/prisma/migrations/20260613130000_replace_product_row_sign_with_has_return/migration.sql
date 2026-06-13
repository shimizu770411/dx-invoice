-- ProductRow: sign カラムを廃止し、has_return カラムに置き換え
-- 業務仕様変更: 加算/減算を行ごとに設定するのではなく、
-- 「返品あり」フラグで1行から加算+減算の2行を自動展開する方針に変更
ALTER TABLE "product_rows" ADD COLUMN "has_return" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "product_rows" DROP COLUMN "sign";
