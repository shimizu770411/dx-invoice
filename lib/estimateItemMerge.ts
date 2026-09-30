import { ProductItem } from '@/lib/products'
import { EstimateItem } from '@/lib/estimates'
import { scopeApplies } from '@/lib/productScope'
import { resolveUnitPriceGeneral, resolveUnitPriceMember } from '@/lib/itemPricing'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'

// 見積の明細行を組み立てる判定ロジック。
// 画面のフックから切り離してあるのは、プラン切替と読み込みで挙動が変わる分岐が多く、
// 単体テストで固定しておきたいため。

// 新規作成時: 商品マスタ → 初期明細行（プラン限定セット化商品は、その適用範囲が現在の会員区分に合う場合のみ qty=1）
export function buildNewEstimateItems(filteredProducts: ProductItem[], isMember: boolean): EstimateItem[] {
    const ordered: EstimateItem[] = []
    const addedIds = new Set<string>()
    for (const product of filteredProducts) {
        const key = String(product.id)
        if (addedIds.has(key)) continue
        if ((product as any).isMultiRow && (product as any).rows?.length > 0) {
            const expanded = expandMultiRowToItems<EstimateItem>(
                product,
                ordered.length,
                (product as any).defaultDescription ?? ''
            )
            ordered.push(...expanded.map((it) => ({ ...it, qty: 0, amount: 0 })))
        } else if ((product as any).hasVariantGroups) {
            ordered.push({
                productItemId: product.id,
                description: (product as any).defaultDescription ?? '',
                unitPriceGeneral: 0,
                unitPriceMember: 0,
                qty: 0,
                amount: 0,
                sortNo: ordered.length,
                productItem: { ...product },
            } as EstimateItem)
        } else {
            const defaultVariant =
                product.variants.find((v: any) => v.isDefaultSet) ?? product.variants[0] ?? null
            const isForcedSet =
                (!!(product as any).isPlanForcedSet && scopeApplies((product as any).setableScope, isMember)) ||
                !!(product as any).isSoleSetParent ||
                !!(product as any).isSoleSetParentChild
            ordered.push({
                productItemId: product.id,
                productVariantId: defaultVariant?.id ?? undefined,
                description: (product as any).defaultDescription ?? '',
                unitPriceGeneral: (defaultVariant as any)?.priceGeneral || 0,
                unitPriceMember: (defaultVariant as any)?.priceMember || 0,
                qty: isForcedSet ? 1 : 0,
                amount: 0,
                sortNo: ordered.length,
                productItem: { ...product },
                productVariant: defaultVariant,
            } as EstimateItem)
        }
        addedIds.add(key)
    }
    return ordered
}

// 編集時: 1商品 → 既存明細とマージした明細行
// isPlanChange=true（プラン切替）のときだけ、プラン別の初期種類への追従と
// 疑似セット子化の自動チェック付け外しを行う。読み込み時にこれを走らせると、
// 保存済みの単価が商品マスタの現在価格で上書きされてしまう。
export function buildEstimateItemsForProduct(
    product: any,
    startSortNo: number,
    existingItems: EstimateItem[],
    isMember: boolean,
    isPlanChange: boolean
): EstimateItem[] {
    if (product.isMultiRow && product.rows?.length > 0) {
        const out: EstimateItem[] = []
        let cursor = startSortNo
        for (const row of product.rows as any[]) {
            const def = row.variants?.find((v: any) => v.isDefault) ?? row.variants?.[0]
            const signs: (1 | -1)[] = row.hasReturn ? [1, -1] : [1]
            // 加算行(sign=1)が既に保存されていれば、その種類・単価を新規生成する行のデフォルトにする。
            // 返品数量が未入力(qty=0)の間は返品行が保存されず、再読込のたびに商品マスタの
            // デフォルト種類(先頭行)で作り直されてしまい、加算行で選んだ種類と単価がズレるため。
            const existingPrimary = existingItems.find(
                (item) =>
                    String((item as any).productRowId ?? '') === String(row.id) &&
                    Number((item as any).sign ?? 1) === 1
            )
            const primaryVariant = existingPrimary
                ? row.variants?.find(
                      (v: any) => String(v.id) === String((existingPrimary as any).productRowVariantId)
                  ) ?? def
                : def
            const primaryUnitPrice = existingPrimary?.unitPriceGeneral ?? primaryVariant?.unitPrice ?? 0
            for (const sign of signs) {
                const existing = existingItems.find(
                    (item) =>
                        String((item as any).productRowId ?? '') === String(row.id) &&
                        Number((item as any).sign ?? 1) === sign
                )
                if (existing) {
                    out.push({ ...existing, productItem: { ...product }, productRow: row } as EstimateItem)
                } else {
                    out.push({
                        productItemId: product.id,
                        productRowId: String(row.id),
                        productRowVariantId: primaryVariant ? String(primaryVariant.id) : null,
                        calcType: row.calcType,
                        sign,
                        description: product.defaultDescription ?? '',
                        unitPriceGeneral: primaryUnitPrice,
                        unitPriceMember: primaryUnitPrice,
                        qty: 0,
                        amount: 0,
                        sortNo: cursor,
                        productItem: { ...product },
                        productRow: row,
                        productRowVariant: primaryVariant,
                    } as EstimateItem)
                }
                cursor++
            }
        }
        return out
    }
    const allExisting = existingItems.filter(
        (item) => item.productItemId === product.id && !(item as any).productRowId
    )
    if (product.hasVariantGroups) {
        const groupExisting = allExisting.filter((item) => (item as any).productVariantGroupId)
        if (groupExisting.length > 0) {
            const groupSelectionsMap: Record<string, string[]> = {}
            for (const gi of groupExisting) {
                const gid = String((gi as any).productVariantGroupId)
                if (!groupSelectionsMap[gid]) groupSelectionsMap[gid] = []
                // 合算行（multiSelectVariantIds）は複数IDをまとめて展開、通常行はproductVariantIdを1件追加
                if ((gi as any).multiSelectVariantIds) {
                    try {
                        const ids: string[] = JSON.parse((gi as any).multiSelectVariantIds)
                        groupSelectionsMap[gid].push(...ids)
                    } catch { /* ignore */ }
                } else if (gi.productVariantId) {
                    groupSelectionsMap[gid].push(String(gi.productVariantId))
                }
            }
            return [{
                productItemId: product.id,
                description: product.defaultDescription ?? '',
                unitPriceGeneral: groupExisting.reduce((s, gi) => s + gi.unitPriceGeneral * (gi.qty || 1), 0),
                unitPriceMember: groupExisting.reduce((s, gi) => s + gi.unitPriceMember * (gi.qty || 1), 0),
                qty: 1,
                amount: 0,
                sortNo: startSortNo,
                productItem: { ...product },
                groupSelections: JSON.stringify(groupSelectionsMap),
            } as EstimateItem]
        }
        return [{
            productItemId: product.id,
            description: product.defaultDescription ?? '',
            unitPriceGeneral: 0,
            unitPriceMember: 0,
            qty: 0,
            amount: 0,
            sortNo: startSortNo,
            productItem: { ...product },
        } as EstimateItem]
    }
    if (allExisting.length > 0) {
        if (product.isMultiSelect && product.multiSelectMerge === false && allExisting.length > 1) {
            const variantIds = allExisting.map((it: any) => String(it.productVariantId)).filter(Boolean)
            // 単価は保存済み明細の合計を使う。商品マスタの現在価格で集計し直すと、
            // 価格改定後に旧書類を開いただけで金額が変わり、保存で確定してしまう。
            return [{
                ...allExisting[0],
                productItem: { ...product },
                multiSelectVariantIds: JSON.stringify(variantIds),
                unitPriceGeneral: allExisting.reduce((s, it) => s + (it.unitPriceGeneral || 0), 0),
                unitPriceMember: allExisting.reduce((s, it) => s + (it.unitPriceMember || 0), 0),
            } as EstimateItem]
        }
        const existing = allExisting[0]
        // プラン切替でこの商品の疑似セット子化状態、または「プラン内で唯一のセット親商品」状態が変わった場合、
        // 自動チェックの付け外しを行う（疑似セット子化は、セット可否の適用範囲が現在の会員区分に合う場合のみ有効）
        const wasForcedSet =
            (!!(existing as any).productItem?.isPlanForcedSet &&
                scopeApplies((existing as any).productItem?.setableScope, isMember)) ||
            !!(existing as any).productItem?.isSoleSetParent ||
            !!(existing as any).productItem?.isSoleSetParentChild
        const isForcedSet =
            (!!product.isPlanForcedSet && scopeApplies(product.setableScope, isMember)) ||
            !!product.isSoleSetParent ||
            !!product.isSoleSetParentChild
        // 商品マスタから消えた商品を補った場合、種類一覧が無いこともある
        const productVariants: any[] = product.variants ?? []
        const newDefaultVariant = productVariants.find((v: any) => v.isDefaultSet) ?? productVariants[0] ?? null
        // セット扱いの判定は種類側の初期セット品フラグを見るため、選択中の種類も
        // プラン適用後のものに引き直す。保存値のままだと、プランでセット化した
        // 商品がこの画面でだけ満額で計上される。
        // 探すのは保存済みの種類IDなので、担当者が選んだ種類そのものは変わらない
        const planAppliedVariant =
            ((existing as any).productVariantId
                ? productVariants.find(
                      (v: any) => String(v.id) === String((existing as any).productVariantId)
                  )
                : undefined) ?? (existing as any).productVariant
        // プラン別のデフォルト種類は、プランを切り替えると変わりうる。
        // 切替後はそのプランの初期種類に必ず揃える（チェック済みでも、担当者が選び直した後でも上書きする）。
        // 以前は「まだチェックしていない商品だけ」追従させていたが、
        // 基本プランの時点で自動チェックが入る商品は永久に追従せず、プラン設定が効かなかった。
        const oldDefaultVariant =
            (existing as any).productItem?.variants?.find((v: any) => v.isDefaultSet) ?? null
        // 種類の入れ替えと、それに伴う商品マスタの現在価格の取り込みは、プラン切替時にだけ行う。
        // 読み込み時にも行うと、価格改定後に旧書類を開いただけで保存済みの単価が上書きされる。
        const defaultVariantChanged =
            isPlanChange && String(newDefaultVariant?.id ?? '') !== String(oldDefaultVariant?.id ?? '')
        const planDefaultVariantPatch =
            defaultVariantChanged && newDefaultVariant
                ? {
                      productVariantId: newDefaultVariant.id,
                      productVariant: newDefaultVariant,
                      unitPriceGeneral: resolveUnitPriceGeneral(existing, newDefaultVariant),
                      unitPriceMember: resolveUnitPriceMember(existing, newDefaultVariant, isMember),
                  }
                : {}

        if (isForcedSet && !wasForcedSet && !(existing.qty > 0)) {
            // 新たに疑似セット子化 / 唯一の親商品化された瞬間(かつユーザーがまだチェックしていない): 自動チェックする
            // 読み込み時は数量を立てるだけにとどめ、種類と単価は保存済みの値を保つ
            return [{
                ...existing,
                productItem: { ...product },
                productVariant: planAppliedVariant,
                ...(isPlanChange && newDefaultVariant
                    ? {
                          productVariantId: newDefaultVariant.id,
                          productVariant: newDefaultVariant,
                          unitPriceGeneral: resolveUnitPriceGeneral(existing, newDefaultVariant),
                          unitPriceMember: resolveUnitPriceMember(existing, newDefaultVariant, isMember),
                      }
                    : {}),
                qty: 1,
            } as EstimateItem]
        }
        if (!isForcedSet && wasForcedSet && existing.qty === 1) {
            // 疑似セット子化 / 唯一の親商品状態が解除された瞬間(かつ自動チェック時の数量から変更されていない): 自動チェックを解除する
            return [{
                ...existing,
                productItem: { ...product },
                productVariant: planAppliedVariant,
                ...planDefaultVariantPatch,
                qty: 0,
            } as EstimateItem]
        }
        if (defaultVariantChanged) {
            return [{
                ...existing,
                productItem: { ...product },
                productVariant: planAppliedVariant,
                ...planDefaultVariantPatch,
            } as EstimateItem]
        }
        return [{ ...existing, productItem: { ...product }, productVariant: planAppliedVariant }]
    }
    const defaultVariant =
        (product.variants ?? []).find((v: any) => v.isDefaultSet) ?? (product.variants ?? [])[0] ?? null
    // 初期セット品の自動チェックは、プラン切替時にだけ行う。
    // 数量0の明細は保存されない（onSubmit で qty>0 のみ送信）ため、読み込み時にも自動チェックすると
    // 「担当者がチェックを外した初期セット品」と「もともと未選択の商品」を区別できず、
    // 外したはずのセット商品が開くたびに復活してしまう。
    return [{
        productItemId: product.id,
        productVariantId: defaultVariant?.id ?? undefined,
        description: product.defaultDescription ?? '',
        unitPriceGeneral: defaultVariant?.priceGeneral || 0,
        unitPriceMember: defaultVariant?.priceMember || 0,
        qty:
            isPlanChange &&
            ((!!product.isPlanForcedSet && scopeApplies(product.setableScope, isMember)) ||
                !!product.isSoleSetParent ||
                !!product.isSoleSetParentChild)
                ? 1
                : 0,
        amount: 0,
        sortNo: startSortNo,
        productItem: { ...product },
        productVariant: defaultVariant,
    } as EstimateItem]
}

// 編集時: 全商品 × 既存明細 → マージ済み明細リスト
export function buildMergedEstimateItems(
    filteredProducts: ProductItem[],
    existingItems: EstimateItem[],
    isMember: boolean,
    isPlanChange: boolean
): EstimateItem[] {
    const mergedItems: EstimateItem[] = []
    const addedIds = new Set<string>()
    for (const product of filteredProducts) {
        const key = String(product.id)
        if (addedIds.has(key)) continue
        mergedItems.push(
            ...buildEstimateItemsForProduct(product, mergedItems.length, existingItems, isMember, isPlanChange)
        )
        addedIds.add(key)
    }
    return mergedItems
}
