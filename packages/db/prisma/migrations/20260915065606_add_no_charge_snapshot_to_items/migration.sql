-- 保存時点で「この明細行が 0 円扱い（セット組込み・サービス・満期サービス）だったか」と、
-- その理由を見積/請求の明細行に控える。
-- 0円扱いの判定には商品マスタとプラン別商品設定の現在値が必要なため、控えが無いと
-- 商品マスタやプラン設定を変えた時点で発行済み書類の金額まで動いてしまう。
-- 理由も控えるのは、0円行の金額欄には金額ではなく「セット」等の文字を印字するため。
-- 既存の書類には値が入らないため、未設定（NULL）のときは従来どおり現在の設定から判定し直す。
-- NULL（未記録）と NONE（課金と記録済み）は意味が違うので、既定値は置かない。

-- CreateEnum
CREATE TYPE "NoChargeReason" AS ENUM ('SET', 'SERVICE', 'MATURITY_SERVICE');

-- AlterTable
ALTER TABLE "estimate_items" ADD COLUMN     "no_charge_reason" "NoChargeReason",
ADD COLUMN     "no_charge_scope" "AppliesTo";

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "no_charge_reason" "NoChargeReason",
ADD COLUMN     "no_charge_scope" "AppliesTo";
