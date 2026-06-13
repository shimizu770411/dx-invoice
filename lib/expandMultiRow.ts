import { ProductItem, ProductRow, ProductRowVariant } from '@/lib/products'
import { EstimateItem } from '@/lib/estimates'
import { InvoiceItem } from '@/lib/invoices'

/**
 * 複数行構成商品（isMultiRow=true）の ProductItem を、複数の明細行へ展開する。
 *
 * - ProductRow ごとに1行ずつ EstimateItem/InvoiceItem を生成
 * - hasReturn=true の ProductRow は加算行 + 返品（減算）行の2行を生成
 * - 各行のデフォルト variant を選択（isDefault=true、なければ先頭）
 * - 加算/返品の variant は同期（種類は同じ）
 *
 * 単一行（isMultiRow=false）の商品は呼び出し元で別途処理する。
 */
export function expandMultiRowToItems<T extends EstimateItem | InvoiceItem>(
    product: ProductItem,
    startSortNo: number,
    defaultDescription: string = ''
): T[] {
    if (!product.isMultiRow || !product.rows || product.rows.length === 0) return []

    const result: T[] = []
    let cursor = startSortNo
    for (const row of product.rows) {
        const def =
            row.variants.find((v) => v.isDefault) ?? row.variants[0] ?? undefined
        const unitPrice = def?.unitPrice ?? 0
        const qty = row.defaultQty ?? 1
        const buildItem = (sign: 1 | -1): T => ({
            productItemId: product.id,
            productRowId: row.id,
            productRowVariantId: def?.id ?? null,
            calcType: row.calcType,
            sign,
            description: defaultDescription,
            unitPriceGeneral: unitPrice,
            unitPriceMember: unitPrice,
            qty: sign === -1 ? 0 : qty,
            amount: computeMultiRowAmount({
                calcType: row.calcType,
                sign,
                unitPrice,
                qty: sign === -1 ? 0 : qty,
            }),
            isService: false,
            sortNo: cursor++,
            productItem: product,
            productRow: row,
            productRowVariant: def,
        }) as unknown as T

        result.push(buildItem(1))
        if (row.hasReturn) {
            result.push(buildItem(-1))
        }
    }
    return result
}

/**
 * 複数行明細の金額計算
 * - FIXED: unitPrice × sign (数量無視)
 * - UNIT_PRICE_X_QTY: unitPrice × qty × sign
 */
export function computeMultiRowAmount(args: {
    calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null | undefined
    sign?: number
    unitPrice: number
    qty: number
}): number {
    const sign = args.sign === -1 ? -1 : 1
    if (args.calcType === 'FIXED') {
        return args.unitPrice * sign
    }
    return args.unitPrice * (args.qty || 0) * sign
}

/** その明細が複数行構成行か判定 */
export function isMultiRowItem(item: {
    productRowId?: string | null
    calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null
}): boolean {
    return !!item.productRowId && !!item.calcType
}
