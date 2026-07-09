-- estimates と invoices に備考欄（remarks）を追加
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
