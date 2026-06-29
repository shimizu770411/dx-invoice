-- 事前相談見積と本見積を区別するための estimate_type カラムを追加
CREATE TYPE "EstimateType" AS ENUM ('PRE_CONSULTATION', 'FORMAL');

ALTER TABLE "estimates" ADD COLUMN "estimate_type" "EstimateType" NOT NULL DEFAULT 'PRE_CONSULTATION';

-- 既存の CONFIRMED 見積を本見積（FORMAL）として移行し、status を DRAFT に戻す
UPDATE "estimates" SET "estimate_type" = 'FORMAL', "status" = 'DRAFT' WHERE "status" = 'CONFIRMED';
