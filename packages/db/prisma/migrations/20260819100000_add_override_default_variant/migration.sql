-- AlterTable
ALTER TABLE "product_plan_settings" ADD COLUMN     "override_default_variant_id" BIGINT;

-- AddForeignKey
ALTER TABLE "product_plan_settings" ADD CONSTRAINT "product_plan_settings_override_default_variant_id_fkey" FOREIGN KEY ("override_default_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
