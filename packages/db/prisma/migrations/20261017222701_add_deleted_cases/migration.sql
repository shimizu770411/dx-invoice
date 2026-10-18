-- CreateTable
CREATE TABLE "deleted_cases" (
    "id" BIGSERIAL NOT NULL,
    "original_customer_id" BIGINT NOT NULL,
    "reception_no" VARCHAR(30),
    "deceased_name" VARCHAR(100) NOT NULL,
    "chief_mourner_name" VARCHAR(100),
    "summary" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "deleted_by_id" BIGINT,
    "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_cases_deleted_at_idx" ON "deleted_cases"("deleted_at");

-- AddForeignKey
ALTER TABLE "deleted_cases" ADD CONSTRAINT "deleted_cases_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
