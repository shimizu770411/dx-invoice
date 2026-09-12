import { ProductVariant } from '@/lib/products'
import { applySurchargeToPrice } from '@/lib/planSurcharges'

type ItemForPricing = {
    productItem?: { isSetChild?: boolean | null } | null
    /** 親祭壇の増額。選ばれていれば一般単価・会員単価の両方に上乗せする */
    surchargeAmount?: number | null
}

// 引数で明示された増額を優先し、指定が無ければ明細行が保持している増額を使う
function pickSurcharge(item: ItemForPricing, surchargeAmount?: number | null): number | null | undefined {
    return surchargeAmount !== undefined ? surchargeAmount : item.surchargeAmount
}

/**
 * 明細行の unitPriceMember として保存すべき値を算出する。
 * setPrice は業務上未使用のため、商品マスタの会員価格に親祭壇の増額を足した値を返す。
 *
 * 増額は必ず商品マスタの価格を基準に足すこと。
 * 明細行の現在の単価に足すと、種類を選び直すたびに何重にも上乗せされてしまう。
 */
export function resolveUnitPriceMember(
    item: ItemForPricing,
    variant: Pick<ProductVariant, 'priceMember'>,
    isMember: boolean,
    surchargeAmount?: number | null
): number {
    return applySurchargeToPrice(variant.priceMember, pickSurcharge(item, surchargeAmount))
}

/**
 * 明細行の unitPriceGeneral として保存すべき値を算出する。
 * 会員価格と同様に、親祭壇の増額を商品マスタの一般価格へ足した値を返す。
 */
export function resolveUnitPriceGeneral(
    item: ItemForPricing,
    variant: Pick<ProductVariant, 'priceGeneral'>,
    surchargeAmount?: number | null
): number {
    return applySurchargeToPrice(variant.priceGeneral, pickSurcharge(item, surchargeAmount))
}
