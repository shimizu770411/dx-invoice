-- CreateEnum
CREATE TYPE "AltarType" AS ENUM ('NONE', 'PAPER', 'WOOD', 'ANNIVERSARY', 'BUTSUSHIKI_4SHAKU', 'YOFU_4SHAKU');

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "altar_type" "AltarType";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "altar_type" "AltarType";
