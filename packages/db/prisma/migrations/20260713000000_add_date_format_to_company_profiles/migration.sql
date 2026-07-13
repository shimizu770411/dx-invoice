-- company_profiles に日付表示形式フラグを追加
-- 'WESTERN'（西暦）または 'JAPANESE'（和暦）。既存レコードは西暦をデフォルトとする。
ALTER TABLE "company_profiles" ADD COLUMN "date_format" VARCHAR(20) NOT NULL DEFAULT 'WESTERN';
