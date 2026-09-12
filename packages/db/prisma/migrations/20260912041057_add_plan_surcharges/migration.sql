-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "plan_surcharge_id" BIGINT,
ADD COLUMN     "surcharge_amount" INTEGER;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "plan_surcharge_id" BIGINT,
ADD COLUMN     "surcharge_amount" INTEGER;

-- CreateTable
CREATE TABLE "plan_surcharges" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "amount" INTEGER NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_surcharges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_surcharges_plan_id_sort_no_idx" ON "plan_surcharges"("plan_id", "sort_no");

-- AddForeignKey
ALTER TABLE "plan_surcharges" ADD CONSTRAINT "plan_surcharges_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_plan_surcharge_id_fkey" FOREIGN KEY ("plan_surcharge_id") REFERENCES "plan_surcharges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_plan_surcharge_id_fkey" FOREIGN KEY ("plan_surcharge_id") REFERENCES "plan_surcharges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
