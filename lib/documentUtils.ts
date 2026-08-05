export const MATURITY_SERVICE_NAME = '満期サービス'
export const CANCELLATION_FEE_NAME = '解約手数料'
export const EXECUTION_SURCHARGE_NAME = '施行割増券'
export const EXECUTION_SURCHARGE_AMOUNT = -50000

type DocumentFreeItemBase = {
    parentProductItemId?: string | null
    productItemName: string
    description?: string
    unitPriceGeneral: number
    qty: number
    amount: number
    sortNo?: number
}

const FIXED_FREE_ROW_COUNT = 5

// フリー行を 5 行に揃え、末尾に fixedRowNames の固定行を順番に追加する。
// 既存データがあれば引き継ぎ、なければ初期値で生成。摘要は固定行では常に空にする。
export function padDocumentFreeItems<T extends DocumentFreeItemBase>(
    arr: T[],
    fixedRowNames: string[]
): T[] {
    const fixedSet = new Set(fixedRowNames)
    const others = arr.filter((it) => !fixedSet.has(it.productItemName))

    const padded: T[] = others.slice()
    while (padded.length < FIXED_FREE_ROW_COUNT) {
        padded.push({ productItemName: '', description: '', unitPriceGeneral: 0, qty: 0, amount: 0, sortNo: padded.length } as T)
    }

    fixedRowNames.forEach((name, idx) => {
        const existing = arr.find((it) => it.productItemName === name)
        // 施行割増券は金額固定・編集不可のため、既存データがあっても常に規定額で上書きする
        const forcedUnitPrice = name === EXECUTION_SURCHARGE_NAME ? EXECUTION_SURCHARGE_AMOUNT : undefined
        padded.push(
            existing
                ? {
                      ...existing,
                      description: '',
                      sortNo: FIXED_FREE_ROW_COUNT + idx,
                      ...(forcedUnitPrice !== undefined ? { unitPriceGeneral: forcedUnitPrice } : {}),
                  }
                : {
                      productItemName: name,
                      description: '',
                      unitPriceGeneral: forcedUnitPrice ?? 0,
                      qty: 0,
                      amount: 0,
                      sortNo: FIXED_FREE_ROW_COUNT + idx,
                  } as T
        )
    })

    return padded
}

export function sortByProductItemId<T extends { productItemId?: string | null }>(arr: T[]): T[] {
    return arr.slice().sort((a, b) => {
        if (a.productItemId == null) return 1
        if (b.productItemId == null) return -1
        return Number(a.productItemId) - Number(b.productItemId)
    })
}

// EACH モード（isMultiSelect=true, multiSelectMerge=false）の明細行を
// バリアントごとに複数行へ展開し、sortNo を振り直して返す
export function expandEachModeItems<T extends { qty: number; multiSelectVariantIds?: string | null; [key: string]: any }>(
    activeItems: T[],
    isMember: boolean
): T[] {
    return activeItems.flatMap((item) => {
        const pi = item.productItem
        if (!pi?.isMultiSelect || pi.multiSelectMerge !== false) return [item]
        if (!item.multiSelectVariantIds) return [item]
        try {
            const ids: string[] = JSON.parse(item.multiSelectVariantIds)
            if (ids.length === 0) return [item]
            return ids.flatMap((variantId: string) => {
                const v = (pi.variants || []).find((v: any) => String(v.id) === variantId)
                if (!v) return []
                return [{ ...item, productVariantId: String(v.id), productVariant: v,
                    unitPriceGeneral: v.priceGeneral, unitPriceMember: v.priceMember,
                    amount: (isMember ? v.priceMember : v.priceGeneral) * item.qty,
                    multiSelectVariantIds: null, description: v.name }]
            })
        } catch { return [item] }
    }).map((item, i) => ({ ...item, sortNo: i }))
}

// グループ商品（重箱等、基本セット＋追加オプションのグループ構成）の代表行を、
// グループごとの選択結果（groupSelections: JSON文字列 { [groupId]: variantId[] }）に基づいて
// 実際の明細行（グループ選択1つにつき1行）へ展開し、sortNo を振り直して返す
export function expandVariantGroupItems<T extends { qty: number; groupSelections?: string | null; [key: string]: any }>(
    activeItems: T[],
    isMember: boolean
): T[] {
    return activeItems.flatMap((item) => {
        const pi = item.productItem
        if (!pi?.hasVariantGroups) return [item]
        if (!item.groupSelections) return [item]
        try {
            const selections: Record<string, string[]> = JSON.parse(item.groupSelections)
            const groups = pi.variantGroups || []
            const rows: T[] = []
            for (const group of groups) {
                const selectedIds = selections[String(group.id)] || []
                if (selectedIds.length === 0) continue
                // MULTI選択グループで合算表示（mergeDisplay、デフォルトtrue）かつ2件以上選択時は1行に合算する
                const isMergedGroup = group.selectionType === 'MULTI' && group.mergeDisplay !== false
                if (isMergedGroup && selectedIds.length > 1) {
                    const selectedVariants = (group.variants || []).filter((vv: any) =>
                        selectedIds.includes(String(vv.id))
                    )
                    if (selectedVariants.length === 0) continue
                    const totalGeneral = selectedVariants.reduce((s: number, v: any) => s + v.priceGeneral, 0)
                    const totalMember = selectedVariants.reduce((s: number, v: any) => s + v.priceMember, 0)
                    rows.push({
                        ...item,
                        productVariantId: String(selectedVariants[0].id),
                        productVariant: selectedVariants[0],
                        productVariantGroupId: String(group.id),
                        multiSelectVariantIds: JSON.stringify(selectedIds),
                        unitPriceGeneral: totalGeneral,
                        unitPriceMember: totalMember,
                        qty: 1,
                        amount: (isMember ? totalMember : totalGeneral) * 1,
                        description: selectedVariants.map((v: any) => v.name).join('、'),
                        groupSelections: null,
                    })
                    continue
                }
                for (const variantId of selectedIds) {
                    const v = (group.variants || []).find((vv: any) => String(vv.id) === variantId)
                    if (!v) continue
                    rows.push({
                        ...item,
                        productVariantId: String(v.id),
                        productVariant: v,
                        productVariantGroupId: String(group.id),
                        unitPriceGeneral: v.priceGeneral,
                        unitPriceMember: v.priceMember,
                        qty: 1,
                        amount: (isMember ? v.priceMember : v.priceGeneral) * 1,
                        description: v.name,
                        groupSelections: null,
                    })
                }
            }
            return rows.length > 0 ? rows : []
        } catch {
            return [item]
        }
    }).map((item, i) => ({ ...item, sortNo: i }))
}

// フリー行を親付き/親なしに分離し、パディング・自動生成を行って結合して返す
// fixedRowNames: 末尾に固定配置する行名（見積: [満期サービス]、請求書: [満期サービス, 解約手数料]）
// ignoreQtyFilter: true のとき qty に関わらず canAddFreeRow=true の全商品に親リンク行を生成する（新規作成時に使用）
export function buildDocumentFreeItems<T extends DocumentFreeItemBase>(
    loadedFreeItems: T[],
    mergedItems: Array<{ qty?: number | null; productItem?: any }>,
    fixedRowNames: string[],
    options?: { ignoreQtyFilter?: boolean }
): T[] {
    const standaloneFreeItems = loadedFreeItems.filter((fi) => !fi.parentProductItemId)
    const parentLinkedFreeItems = loadedFreeItems.filter((fi) => fi.parentProductItemId)

    const paddedStandaloneFreeItems = padDocumentFreeItems(standaloneFreeItems, fixedRowNames)

    const existingParentIds = new Set(
        parentLinkedFreeItems.map((fi) => String(fi.parentProductItemId))
    )
    const autoGeneratedFreeItems: T[] = []
    for (const item of mergedItems) {
        if (!options?.ignoreQtyFilter && (!item.qty || item.qty <= 0)) continue
        const product = item.productItem as any
        if (!product?.canAddFreeRow) continue
        const pid = String(product.id)
        if (existingParentIds.has(pid)) continue
        autoGeneratedFreeItems.push({
            parentProductItemId: pid,
            productItemName: '',
            description: '',
            unitPriceGeneral: 0,
            qty: 0,
            amount: 0,
            sortNo: 9999,
        } as T)
    }

    return [
        ...paddedStandaloneFreeItems,
        ...parentLinkedFreeItems,
        ...autoGeneratedFreeItems,
    ]
}

// docNo 採番: reception_at の年月（yyyymm）プレフィックスを返す
export function buildDocNoPrefix(receptionAt: Date | string | null | undefined): string {
    const date = receptionAt ? new Date(receptionAt) : new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    return `${yyyy}${mm}`
}

// docNo 採番: プレフィックスと最新 docNo から次の連番 docNo を返す
// override が指定されている場合（フォームから送られてきた値）はそちらを優先する
export function buildDocNo(prefix: string, latestDocNo: string | null | undefined, override?: string): string {
    if (override) return override
    const nextSeq = latestDocNo ? parseInt(latestDocNo.slice(6)) + 1 : 1
    return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

// docNo の形式チェック: yyyymm(6桁) + 連番(3桁) の9桁数字のみを正とする
export const DOC_NO_LENGTH = 9
const DOC_NO_PATTERN = new RegExp(`^\\d{${DOC_NO_LENGTH}}$`)
export function isValidDocNo(docNo: string): boolean {
    return DOC_NO_PATTERN.test(docNo)
}

// 同一プレフィックスの docNo 群から、正しい形式のもののみを対象に最新（数値最大）の値を選ぶ。
// 文字列ソートでは桁数の異なる不正値（例: 手入力の "20260714"）が誤って最新扱いされるため、数値比較する。
export function pickLatestValidDocNo(docNos: (string | null | undefined)[]): string | null {
    const valid = docNos.filter((d): d is string => !!d && isValidDocNo(d))
    if (valid.length === 0) return null
    return valid.reduce((max, cur) => (Number(cur) > Number(max) ? cur : max))
}
