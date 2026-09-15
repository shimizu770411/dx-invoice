/**
 * 見積・請求書の明細に表示する商品名・種類名の決定ルール。
 *
 * 明細行には保存時点の商品名・種類名を控えてある。商品マスタで改名しても
 * 発行済み書類の文言が変わらないよう、表示はこの控えを優先する。
 * 控えが無い（この項目を追加する前に作られた）書類だけ、商品マスタの名称にフォールバックする。
 */

type ItemWithNames = {
    productItemName?: string | null
    productVariantName?: string | null
}

/** 明細行に表示する商品名。控えが無ければ商品マスタの名称を使う */
export function displayProductItemName(
    item: ItemWithNames | null | undefined,
    masterName?: string | null
): string {
    return item?.productItemName ?? masterName ?? ''
}

/** 明細行に表示する種類名。控えが無ければ商品マスタの名称を使う */
export function displayProductVariantName(
    item: ItemWithNames | null | undefined,
    masterName?: string | null
): string {
    return item?.productVariantName ?? masterName ?? ''
}
