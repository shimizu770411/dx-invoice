-- CreateEnum
CREATE TYPE "OperationAction" AS ENUM ('CREATE', 'UPDATE', 'ISSUE_PDF', 'REISSUE_PDF');

-- CreateEnum
CREATE TYPE "OperationEntityType" AS ENUM ('ESTIMATE', 'INVOICE', 'RECEIPT');

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action" "OperationAction" NOT NULL,
    "entity_type" "OperationEntityType" NOT NULL,
    "entity_id" BIGINT,
    "doc_no" VARCHAR(30),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_logs_user_id_occurred_at_idx" ON "operation_logs"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "operation_logs_entity_type_action_occurred_at_idx" ON "operation_logs"("entity_type", "action", "occurred_at");

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
