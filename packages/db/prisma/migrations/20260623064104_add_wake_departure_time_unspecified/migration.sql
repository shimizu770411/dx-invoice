-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "departure_at_time_unspecified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wake_at_time_unspecified" BOOLEAN NOT NULL DEFAULT false;
