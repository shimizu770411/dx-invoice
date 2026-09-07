-- CreateTable
CREATE TABLE "plans" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_sort_no_idx" ON "plans"("sort_no");

-- SeedData: 基本プラン(id=1)を先に投入。estimates/invoices の plan_id デフォルト値(1)が参照する。
INSERT INTO "plans" ("name", "sort_no", "updated_at") VALUES
  ('基本プラン', 0, CURRENT_TIMESTAMP),
  ('家族葬27万円コース', 1, CURRENT_TIMESTAMP),
  ('家族葬37万円コース', 2, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "plan_id" BIGINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "plan_id" BIGINT NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "product_plan_settings" (
    "id" BIGSERIAL NOT NULL,
    "plan_id" BIGINT NOT NULL,
    "product_item_id" BIGINT NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_set_parent" BOOLEAN,
    "is_set_child" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_plan_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_plan_settings_plan_id_product_item_id_key" ON "product_plan_settings"("plan_id", "product_item_id");

-- AddForeignKey
ALTER TABLE "product_plan_settings" ADD CONSTRAINT "product_plan_settings_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_plan_settings" ADD CONSTRAINT "product_plan_settings_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "product_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
