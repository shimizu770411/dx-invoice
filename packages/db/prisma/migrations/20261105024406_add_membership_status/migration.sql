-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');

-- AlterTable
ALTER TABLE "customer_memberships" ADD COLUMN     "completed_at" DATE,
ADD COLUMN     "status" "MembershipStatus";
