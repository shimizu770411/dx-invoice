import { ProductVariant } from '@/lib/products'

type ItemForPricing = {
    productItem?: { isSetChild?: boolean | null } | null
}

/**
 * 明細行の unitPriceMember として保存すべき値を算出する。
 * setPrice は業務上未使用のため、常に variant.priceMember を返す。
 */
export function resolveUnitPriceMember(
    item: ItemForPricing,
    variant: Pick<ProductVariant, 'priceMember'>,
    isMember: boolean
): number {
    return variant.priceMember
}
