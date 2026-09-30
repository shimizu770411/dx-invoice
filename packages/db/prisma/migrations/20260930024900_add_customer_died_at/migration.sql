-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "died_at" TIMESTAMPTZ(6),
ADD COLUMN     "died_at_time_unspecified" BOOLEAN NOT NULL DEFAULT false;
