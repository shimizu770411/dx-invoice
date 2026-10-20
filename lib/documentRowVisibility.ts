// 見積・請求書の明細のうち、画面に表示される行と、書類に載る（合計・保存の対象になる）行の判定。
// 画面の表示・画面の合計・保存の3か所で同じ判定を使い、「画面に出ていないのに合計や保存に入る」ことを防ぐ。
//
// 以前は、表示されなくなった行の数量を画面の描画中に裏で0にしていた（setTimeout）。
// そのため親祭壇の数量を0にして戻すと子商品が数量0で出てきたり、開いただけで「未保存の変更」になったりした。
// 今は数量はそのまま残し、表示されない行は合計と保存から外す。

type VisibilityItem = {
    productItemId?: string | number | null
    productItem?: {
        isSetParent?: boolean
        isSetChild?: boolean
        isPlanForcedSet?: boolean
        children?: { id: string | number }[]
    } | null
    // 見積・請求書の明細はほかにも多くの項目を持つ。判定に使うのは上の項目だけ
    [key: string]: unknown
}

type LinkedFreeItem = { parentProductItemId?: string | number | null; [key: string]: unknown }

/**
 * 画面に表示される行か。
 * 親祭壇は1つだけ選べる（どれかが選ばれていれば、ほかの親祭壇は表示しない）。
 * 子のセット商品は、選ばれている親祭壇に紐づくものだけ表示する。
 * プラン設定で疑似セット化された一般商品は親子関係を持たないので常に表示する。
 */
export function documentRowVisibility(items: VisibilityItem[], qtyOf: (index: number) => number): boolean[] {
    const parentIndex = items.findIndex((it, i) => !!it?.productItem?.isSetParent && qtyOf(i) > 0)
    const parentId = parentIndex >= 0 ? String(items[parentIndex].productItemId) : null
    const childIds = new Set(
        parentIndex >= 0 ? (items[parentIndex].productItem?.children ?? []).map((c) => String(c.id)) : []
    )
    return items.map((it) => {
        const pi = it?.productItem
        if (!pi) return true
        if (pi.isSetParent) return parentId === null || String(it.productItemId) === parentId
        if (pi.isSetChild && !pi.isPlanForcedSet) return childIds.has(String(it.productItemId))
        return true
    })
}

/** 書類に載る行か（表示されていて、数量がある） */
export function documentActiveRows(items: VisibilityItem[], qtyOf: (index: number) => number): boolean[] {
    const visible = documentRowVisibility(items, qtyOf)
    return items.map((_, i) => visible[i] && qtyOf(i) > 0)
}

/**
 * 自由入力行が書類に載りうるか。控室管理費などの追加行（親商品つき）は、親商品が書類に載るときだけ。
 * 親の無い自由行・固定行は常に対象（数量・品名の判定は呼び出し側で行う）
 */
export function documentActiveFreeRows(
    freeItems: LinkedFreeItem[],
    items: VisibilityItem[],
    activeItems: boolean[]
): boolean[] {
    return freeItems.map((fi) => isFreeRowParentActive(fi, items, activeItems))
}

/** 1行分の判定（保存時に自由入力行を絞り込むときに使う） */
export function isFreeRowParentActive(
    freeItem: LinkedFreeItem | undefined,
    items: VisibilityItem[],
    activeItems: boolean[]
): boolean {
    if (!freeItem?.parentProductItemId) return true
    const parentId = String(freeItem.parentProductItemId)
    return items.some((it, i) => activeItems[i] && String(it?.productItemId) === parentId)
}
