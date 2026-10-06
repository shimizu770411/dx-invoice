import { AppliesTo, ProductVariant } from '@/lib/products'
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

type ServiceCapability = {
    serviceableScope?: AppliesTo | null
    isMaturityServiceable?: boolean | null
} | null | undefined

type ServiceFlags = { isService?: boolean; isMaturityService?: boolean }

/**
 * 明細のサービス品・満期サービスの印のうち、商品マスタで許可されているものだけを残す。
 * 商品マスタの設定を後から「不可」に戻すと、種類選択ダイアログにチェック欄が出なくなり、
 * 明細に残った印を画面から外せなくなる。外せない印で会員単価が0円にされ続けないよう、ここで落とす。
 * 会員区分による適用範囲は0円扱いの判定（documentTotals）で見るため、ここでは商品として可能かだけを見る。
 */
export function allowedServiceFlags(productItem: ServiceCapability, flags: ServiceFlags) {
    return {
        isService: !!flags.isService && (productItem?.serviceableScope ?? 'NONE') !== 'NONE',
        isMaturityService: !!flags.isMaturityService && !!productItem?.isMaturityServiceable,
    }
}

/** 種類を選び直したときの単価と印。サービス品・満期サービスの会員単価は0円にする */
export function resolveVariantChange(
    item: ItemForPricing & { productItem?: ServiceCapability & { isSetChild?: boolean | null } },
    variant: Pick<ProductVariant, 'priceGeneral' | 'priceMember'>,
    isMember: boolean,
    options: ServiceFlags & { surchargeAmount?: number | null }
) {
    const { isService, isMaturityService } = allowedServiceFlags(item.productItem, options)
    return {
        isService,
        isMaturityService,
        unitPriceGeneral: resolveUnitPriceGeneral(item, variant, options.surchargeAmount),
        unitPriceMember:
            isService || isMaturityService
                ? 0
                : resolveUnitPriceMember(item, variant, isMember, options.surchargeAmount),
    }
}
