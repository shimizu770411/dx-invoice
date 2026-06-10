-- AlterTable
ALTER TABLE "product_items" ADD COLUMN     "default_description" VARCHAR(255);

-- 既存のハードコード DEFAULT_DESCRIPTION_MAP（estimateOptions.ts）の値を移行
-- 商品名が完全一致する既存マスタにのみ適用される（一致しないものはNULLのまま）
UPDATE "product_items" SET "default_description" = '寝棺・特注 (　　　　)' WHERE name = '棺';
UPDATE "product_items" SET "default_description" = '(仏衣・布団)' WHERE name = '納棺用品一式';
UPDATE "product_items" SET "default_description" = '寝台車: 車庫～　〜　迄' WHERE name = '寝台車';
UPDATE "product_items" SET "default_description" = E'車庫～火葬場\n片道•往復 (　　　　km)' WHERE name = '霊柩車';
UPDATE "product_items" SET "default_description" = '飾り幕・御霊灯・門標' WHERE name = '外装飾設備';
UPDATE "product_items" SET "default_description" = '受付台・イス・記録帳' WHERE name = '受付設備';
UPDATE "product_items" SET "default_description" = '放送設備・式進行' WHERE name = '司会';
UPDATE "product_items" SET "default_description" = '位牌・飾り幕・焼香用具' WHERE name = '葬具小物一式';
UPDATE "product_items" SET "default_description" = '紙製・木製・年忌' WHERE name = 'あと飾り祭壇';
UPDATE "product_items" SET "default_description" = 'ローソク・線香・他' WHERE name = '御霊前セット';
UPDATE "product_items" SET "default_description" = '祭壇用・火葬場用・納骨用' WHERE name = '果物・お酒・線香';
