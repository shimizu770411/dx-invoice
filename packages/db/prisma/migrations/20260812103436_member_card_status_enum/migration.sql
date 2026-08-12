-- CreateEnum
CREATE TYPE "MemberCardStatus" AS ENUM ('COLLECTED', 'NOT_COLLECTED', 'LOST');

-- 既存の自由記述値（空文字列）は新しい選択肢に対応しないためNULLに退避
UPDATE "customers" SET "member_card_note" = NULL WHERE "member_card_note" = '';

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "member_card_note" TYPE "MemberCardStatus" USING ("member_card_note"::"MemberCardStatus");
