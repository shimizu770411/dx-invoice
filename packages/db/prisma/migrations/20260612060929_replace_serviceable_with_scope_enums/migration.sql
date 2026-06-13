-- 1. 新しい enum 型を作成
CREATE TYPE "AppliesTo" AS ENUM ('NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH');

-- 2. 新カラムを追加（デフォルト NONE）
ALTER TABLE "product_items"
  ADD COLUMN "serviceable_scope" "AppliesTo" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "setable_scope"     "AppliesTo" NOT NULL DEFAULT 'NONE';

-- 3. 既存データを移行
-- 旧 is_serviceable=true → MEMBER_ONLY（互助会員向けサービスが典型なので保守的に）
UPDATE "product_items"
  SET "serviceable_scope" = 'MEMBER_ONLY'
  WHERE "is_serviceable" = true;

-- セット販売構造を持つ商品（親祭壇 or 子セット）は、過去の挙動「会員のみ初期セット品0円」に合わせて MEMBER_ONLY
UPDATE "product_items"
  SET "setable_scope" = 'MEMBER_ONLY'
  WHERE "is_set_parent" = true OR "is_set_child" = true;

-- 4. 古い is_serviceable カラムを削除
ALTER TABLE "product_items" DROP COLUMN "is_serviceable";
