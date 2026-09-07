-- AlterTable
ALTER TABLE "product_plan_settings" DROP COLUMN "is_set_child",
DROP COLUMN "is_set_parent",
ADD COLUMN     "setable_scope" "AppliesTo";
