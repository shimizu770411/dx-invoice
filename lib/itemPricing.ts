import { ProductVariant } from '@/lib/products'

type ItemForPricing = {
    productItem?: { isSetChild?: boolean | null } | null
}

/**
 * 明細行の unitPriceMember として保存すべき値を算出する。
 *
 * 業務ルール:
 * - 会員 + 子セット品 + 非初期セット種類: setPrice（互助会員の差額請求）
 * - それ以外: 通常の variant.priceMember
 *
 * 初期セット種類（isDefaultSet=true）は表示・合計ロジック側で
 * 「セット」表示・合計対象外として扱う（priceMember を保存しても影響なし）。
 */
export function resolveUnitPriceMember(
    item: ItemForPricing,
    variant: Pick<ProductVariant, 'priceMember' | 'setPrice' | 'isDefaultSet'>,
    isMember: boolean
): number {
    const isSetChild = !!item.productItem?.isSetChild
    if (isMember && isSetChild && !variant.isDefaultSet) {
        return variant.setPrice ?? 0
    }
    return variant.priceMember
}
