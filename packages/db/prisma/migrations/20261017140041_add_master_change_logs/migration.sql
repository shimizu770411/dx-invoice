-- CreateEnum
CREATE TYPE "MasterChangeTargetType" AS ENUM ('PRODUCT', 'PRODUCT_VARIANT', 'PRODUCT_SET', 'PRODUCT_ORDER', 'PLAN', 'PLAN_PRODUCT_SETTING', 'PLAN_SURCHARGE');

-- CreateEnum
CREATE TYPE "MasterChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE');

-- CreateTable
CREATE TABLE "master_change_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "target_type" "MasterChangeTargetType" NOT NULL,
    "action" "MasterChangeAction" NOT NULL,
    "target_id" BIGINT,
    "target_name" VARCHAR(200) NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_change_logs_occurred_at_idx" ON "master_change_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "master_change_logs_user_id_occurred_at_idx" ON "master_change_logs"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "master_change_logs_target_type_target_id_idx" ON "master_change_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "master_change_logs" ADD CONSTRAINT "master_change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
