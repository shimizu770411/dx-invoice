import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getEstimate, createEstimate, updateEstimate, Estimate, EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { getCustomer } from '@/lib/customers'
import { getCompanyProfile } from '@/lib/company'
import { getProducts, ProductItem } from '@/lib/products'
import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { scopeApplies } from '@/lib/productScope'
import { resolveUnitPriceGeneral, resolveUnitPriceMember } from '@/lib/itemPricing'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import { calculateDocumentFormTotals } from '@/lib/documentTotals'
import { useDocumentItems } from '@/hooks/useDocumentItems'
import { expandEachModeItems, expandVariantGroupItems, buildDocumentFreeItems, MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME, EXECUTION_SURCHARGE_AMOUNT } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import { EstimateFormData, DEFAULT_FORM_VALUES } from '../schemas/EstimateFormSchema'


// -------------------------------------------------------
// 商品データ変換ユーティリティ（モジュールレベル純粋関数）
// -------------------------------------------------------

function filterProductsByStore(products: ProductItem[], storeId: string | null): ProductItem[] {
    return products.map((product) => ({
        ...product,
        variants: product.variants.filter(
            (v: any) => !v.storeId || (storeId && String(v.storeId) === storeId)
        ),
    }))
}

// 新規作成時: 商品マスタ → 初期明細行（プラン限定セット化商品は、その適用範囲が現在の会員区分に合う場合のみ qty=1）
function buildNewEstimateItems(filteredProducts: ProductItem[], isMember: boolean): EstimateItem[] {
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
function buildEstimateItemsForProduct(
    product: any,
    startSortNo: number,
    existingItems: EstimateItem[],
    isMember: boolean
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
            const selectedVariants = (product.variants || []).filter((v: any) => variantIds.includes(String(v.id)))
            return [{
                ...allExisting[0],
                productItem: { ...product },
                multiSelectVariantIds: JSON.stringify(variantIds),
                unitPriceGeneral: selectedVariants.reduce((s: number, v: any) => s + v.priceGeneral, 0),
                unitPriceMember: selectedVariants.reduce((s: number, v: any) => s + v.priceMember, 0),
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
        const newDefaultVariant = product.variants.find((v: any) => v.isDefaultSet) ?? product.variants[0] ?? null
        // プラン別のデフォルト種類は、プランを切り替えると変わりうる。
        // 切替後はそのプランの初期種類に必ず揃える（チェック済みでも、担当者が選び直した後でも上書きする）。
        // 以前は「まだチェックしていない商品だけ」追従させていたが、
        // 基本プランの時点で自動チェックが入る商品は永久に追従せず、プラン設定が効かなかった。
        const oldDefaultVariant =
            (existing as any).productItem?.variants?.find((v: any) => v.isDefaultSet) ?? null
        const defaultVariantChanged = String(newDefaultVariant?.id ?? '') !== String(oldDefaultVariant?.id ?? '')
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
            return [{
                ...existing,
                productItem: { ...product },
                productVariantId: newDefaultVariant?.id ?? existing.productVariantId,
                productVariant: newDefaultVariant,
                unitPriceGeneral: newDefaultVariant
                    ? resolveUnitPriceGeneral(existing, newDefaultVariant)
                    : existing.unitPriceGeneral,
                unitPriceMember: newDefaultVariant
                    ? resolveUnitPriceMember(existing, newDefaultVariant, isMember)
                    : existing.unitPriceMember,
                qty: 1,
            } as EstimateItem]
        }
        if (!isForcedSet && wasForcedSet && existing.qty === 1) {
            // 疑似セット子化 / 唯一の親商品状態が解除された瞬間(かつ自動チェック時の数量から変更されていない): 自動チェックを解除する
            return [{ ...existing, productItem: { ...product }, ...planDefaultVariantPatch, qty: 0 } as EstimateItem]
        }
        if (defaultVariantChanged) {
            return [{ ...existing, productItem: { ...product }, ...planDefaultVariantPatch } as EstimateItem]
        }
        return [{ ...existing, productItem: { ...product } }]
    }
    const defaultVariant = product.variants.find((v: any) => v.isDefaultSet) ?? product.variants[0] ?? null
    return [{
        productItemId: product.id,
        productVariantId: defaultVariant?.id ?? undefined,
        description: product.defaultDescription ?? '',
        unitPriceGeneral: defaultVariant?.priceGeneral || 0,
        unitPriceMember: defaultVariant?.priceMember || 0,
        qty:
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
function buildMergedEstimateItems(
    filteredProducts: ProductItem[],
    existingItems: EstimateItem[],
    isMember: boolean
): EstimateItem[] {
    const mergedItems: EstimateItem[] = []
    const addedIds = new Set<string>()
    for (const product of filteredProducts) {
        const key = String(product.id)
        if (addedIds.has(key)) continue
        mergedItems.push(...buildEstimateItemsForProduct(product, mergedItems.length, existingItems, isMember))
        addedIds.add(key)
    }
    return mergedItems
}

// プラン切替時: 新プランで非表示になる商品の明細名を返す（無ければ空配列）
function findItemsDisappearingOnPlanChange(
    snapshot: EstimateItem[],
    newFilteredProducts: ProductItem[]
): string[] {
    const newProductIds = new Set(newFilteredProducts.map((p) => String(p.id)))
    const names = snapshot
        .filter(
            (it) =>
                (it.qty ?? 0) > 0 &&
                it.productItemId &&
                !newProductIds.has(String(it.productItemId))
        )
        .map((it) => (it as any).productItem?.name)
        .filter((name): name is string => !!name)
    return Array.from(new Set(names))
}

// -------------------------------------------------------
// 新規作成フック（customerId から）
// -------------------------------------------------------
export function useEstimateCreate(customerId: string, reset: UseFormReset<EstimateFormData>) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [items, setItems] = useState<EstimateItem[]>([])
    const [freeItems, setFreeItems] = useState<EstimateFreeItem[]>([])
    // プラン切替時に再フィルタするための「店舗のみで絞り込んだ全商品」（プラン絞り込み前）
    const [storeFilteredProducts, setStoreFilteredProducts] = useState<ProductItem[]>([])
    const [planId, setPlanId] = useState<string>(BASE_PLAN_ID)

    const loadData = useCallback(async () => {
        try {
            const [customerData, allProducts] = await Promise.all([getCustomer(customerId), getProducts()])
            const companyProfile = await getCompanyProfile().catch(() => null)
            setCustomer(customerData)
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredByStore = filterProductsByStore(allProducts, storeId)
            setStoreFilteredProducts(filteredByStore)
            setPlanId(BASE_PLAN_ID)
            const planSettings = await getProductPlanSettings(BASE_PLAN_ID)
            const filteredProducts = applyPlanOverrides(filteredByStore, planSettings)
            const initialItems = buildNewEstimateItems(filteredProducts, DEFAULT_FORM_VALUES.isMember === 'true')
            setItems(initialItems)
            const initialFreeItems = buildDocumentFreeItems<EstimateFreeItem>([], initialItems, [MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME], { ignoreQtyFilter: true })
            setFreeItems(initialFreeItems)
            reset({
                ...DEFAULT_FORM_VALUES,
                remarks: companyProfile?.estimateRemarksDefault || '',
                memberCardNote: customerData?.memberCardNote || '',
                items: initialItems.map((item) => ({
                    qty: item.qty,
                    description: item.description || '',
                })),
                freeItems: initialFreeItems.map((item) => ({
                    parentProductItemId: item.parentProductItemId ?? null,
                    productItemName: item.productItemName || '',
                    description: item.description || '',
                    unitPriceGeneral: item.unitPriceGeneral,
                    qty: item.qty,
                })),
            })
        } catch (error) {
            handleLoadError(error)
        } finally {
            setLoading(false)
        }
    }, [customerId, reset])

    // プラン切替: 新プランで非表示になる明細があれば確認の上、明細を再構築する。
    // キャンセル時は null を返す（呼び出し側は planId の select を元に戻す）。
    const handlePlanChange = useCallback(
        async (
            newPlanId: string,
            currentFormItems: { qty?: number; description?: string }[] | undefined,
            isMember: boolean
        ): Promise<EstimateItem[] | null> => {
            const planSettings = await getProductPlanSettings(newPlanId)
            const newFilteredProducts = applyPlanOverrides(storeFilteredProducts, planSettings)
            const snapshot = items.map((item, i) => ({
                ...item,
                qty: currentFormItems?.[i]?.qty ?? item.qty,
                description: currentFormItems?.[i]?.description ?? item.description,
            }))
            const disappearingNames = findItemsDisappearingOnPlanChange(snapshot, newFilteredProducts)
            if (disappearingNames.length > 0) {
                const ok = confirm(
                    `プランを切り替えると、以下の明細は選択できなくなり削除されます:\n\n・${disappearingNames.join('\n・')}\n\nよろしいですか？`
                )
                if (!ok) return null
            }
            const rebuilt = buildMergedEstimateItems(newFilteredProducts, snapshot, isMember)
            setItems(rebuilt)
            setPlanId(newPlanId)
            return rebuilt
        },
        [items, storeFilteredProducts]
    )

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!loading && !customer) {
            toast({ title: '顧客情報が取得できませんでした', variant: 'destructive', duration: 3000 })
            router.push('/cases')
        }
    }, [loading, customer, router])

    const onSubmit = async (formValues: EstimateFormData) => {
        try {
            const isMember = formValues.isMember === 'true'
            const allMergedItems = items.map((item, i) => {
                const qty = formValues.items[i]?.qty ?? item.qty
                const description = formValues.items[i]?.description ?? item.description ?? ''
                const unitPrice = isMember ? item.unitPriceMember : item.unitPriceGeneral
                const amount = unitPrice * qty
                return { ...item, qty, description, amount }
            })
            const activeItems = allMergedItems.filter((item) => item.qty > 0).map((item, i) => ({ ...item, sortNo: i }))
            if (activeItems.length === 0) {
                toast({
                    title: '数量が1以上の品目を少なくとも1つ入力してください',
                    variant: 'destructive',
                    duration: 3000,
                })
                return
            }
            const groupExpandedItems = expandVariantGroupItems(activeItems, isMember)
            const finalItems = expandEachModeItems(groupExpandedItems, isMember)
            const mergedFreeItems = freeItems
                .map((item, i) => {
                    const productItemName = formValues.freeItems[i]?.productItemName ?? item.productItemName ?? ''
                    const isMaturity = productItemName === MATURITY_SERVICE_NAME
                    const isExecutionSurcharge = productItemName === EXECUTION_SURCHARGE_NAME
                    const description = isMaturity || isExecutionSurcharge
                        ? ''
                        : formValues.freeItems[i]?.description ?? item.description ?? ''
                    // 施行割増券は金額固定・編集不可のため、フォーム送信値に関わらず規定額を強制する
                    const unitPriceGeneral = isExecutionSurcharge
                        ? EXECUTION_SURCHARGE_AMOUNT
                        : formValues.freeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
                    const qty = formValues.freeItems[i]?.qty ?? item.qty
                    const amount = unitPriceGeneral * qty
                    return { ...item, productItemName, description, unitPriceGeneral, qty, amount }
                })
                .filter((it) => it.productItemName.trim().length > 0 && it.qty > 0)
                .map((it, i) => ({ ...it, sortNo: i }))
            const totals = calculateDocumentFormTotals(items, formValues.items, isMember, customer, freeItems, formValues.freeItems)
            const data = { ...formValues, ...totals, items: finalItems, freeItems: mergedFreeItems }
            const created = await createEstimate(customerId, data)
            toast({ title: '登録しました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/estimates/${created.id}`)
        } catch (error) {
            handleSaveError(error)
        }
    }

    return { loading, customer, setCustomer, estimate: null as Estimate | null, items, setItems, freeItems, setFreeItems, planId, handlePlanChange, onSubmit }
}

// -------------------------------------------------------
// 編集フック（estimateId から）
// -------------------------------------------------------
export function useEstimateEdit(estimateId: string, reset: UseFormReset<EstimateFormData>) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [estimate, setEstimate] = useState<Estimate | null>(null)
    const [items, setItems] = useState<EstimateItem[]>([])
    const [freeItems, setFreeItems] = useState<EstimateFreeItem[]>([])
    // プラン切替時に再フィルタするための「店舗のみで絞り込んだ全商品」（プラン絞り込み前）
    const [storeFilteredProducts, setStoreFilteredProducts] = useState<ProductItem[]>([])
    const [planId, setPlanId] = useState<string>(BASE_PLAN_ID)

    const loadData = useCallback(async () => {
        try {
            const [estimateData, allProducts] = await Promise.all([getEstimate(estimateId), getProducts()])
            setEstimate(estimateData)
            const existingItems: EstimateItem[] = estimateData.items || []
            const customerData = await getCustomer(estimateData.customerId)
            setCustomer(customerData)
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredByStore = filterProductsByStore(allProducts, storeId)
            setStoreFilteredProducts(filteredByStore)
            const currentPlanId = estimateData.planId || BASE_PLAN_ID
            setPlanId(currentPlanId)
            const planSettings = await getProductPlanSettings(currentPlanId)
            const filteredProducts = applyPlanOverrides(filteredByStore, planSettings)
            const isMember = !!(estimateData as any).isMember
            const mergedItems = buildMergedEstimateItems(filteredProducts, existingItems, isMember)
            const loadedFreeItems: EstimateFreeItem[] = (estimateData as any).freeItems || []
            const paddedFreeItems = buildDocumentFreeItems(loadedFreeItems, mergedItems, [MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME])
            setItems(mergedItems)
            setFreeItems(paddedFreeItems)
            reset({
                docNo: estimateData.docNo || '',
                planId: currentPlanId,
                status: estimateData.status || 'DRAFT',
                isMember: String((estimateData as any).isMember ?? false),
                cremationProcessType: (estimateData as any).cremationProcessType || '',
                altarPlaceType: (estimateData as any).altarPlaceType || '',
                altarPlaceOther: (estimateData as any).altarPlaceOther || '',
                altarType: (estimateData as any).altarType || '',
                ceilingHeight: (estimateData as any).ceilingHeight || '',
                memberCardNote: customerData?.memberCardNote || '',
                preConsultStaff: (estimateData as any).preConsultStaff || '',
                estimateStaff: (estimateData as any).estimateStaff || '',
                ceremonyStaff: (estimateData as any).ceremonyStaff || '',
                transportStaff: (estimateData as any).transportStaff || '',
                decorationStaff: (estimateData as any).decorationStaff || '',
                returnStaff: (estimateData as any).returnStaff || '',
                remarks: (estimateData as any).remarks || '',
                // 【別料金】の金額。未設定は空文字にする（0円との区別を保つため ?? で判定する）
                cremationFee: (estimateData as any).cremationFee ?? '',
                offeringFee: (estimateData as any).offeringFee ?? '',
                newspaperAdFee: (estimateData as any).newspaperAdFee ?? '',
                items: mergedItems.map((item) => ({
                    qty: item.qty,
                    description: item.description || '',
                })),
                freeItems: paddedFreeItems.map((item) => ({
                    parentProductItemId: item.parentProductItemId ?? null,
                    productItemName: item.productItemName || '',
                    description: item.description || '',
                    unitPriceGeneral: item.unitPriceGeneral,
                    qty: item.qty,
                })),
            })
        } catch (error) {
            handleLoadError(error)
        } finally {
            setLoading(false)
        }
    }, [estimateId, reset])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!loading && !estimate) {
            toast({ title: '見積データが取得できませんでした', variant: 'destructive', duration: 3000 })
            router.push('/cases')
        }
    }, [loading, estimate, router])

    // プラン切替: 新プランで非表示になる明細があれば確認の上、明細を再構築する。
    // キャンセル時は null を返す（呼び出し側は planId の select を元に戻す）。
    const handlePlanChange = useCallback(
        async (
            newPlanId: string,
            currentFormItems: { qty?: number; description?: string }[] | undefined,
            isMember: boolean
        ): Promise<EstimateItem[] | null> => {
            const planSettings = await getProductPlanSettings(newPlanId)
            const newFilteredProducts = applyPlanOverrides(storeFilteredProducts, planSettings)
            const snapshot = items.map((item, i) => ({
                ...item,
                qty: currentFormItems?.[i]?.qty ?? item.qty,
                description: currentFormItems?.[i]?.description ?? item.description,
            }))
            const disappearingNames = findItemsDisappearingOnPlanChange(snapshot, newFilteredProducts)
            if (disappearingNames.length > 0) {
                const ok = confirm(
                    `プランを切り替えると、以下の明細は選択できなくなり削除されます:\n\n・${disappearingNames.join('\n・')}\n\nよろしいですか？`
                )
                if (!ok) return null
            }
            const rebuilt = buildMergedEstimateItems(newFilteredProducts, snapshot, isMember)
            setItems(rebuilt)
            setPlanId(newPlanId)
            return rebuilt
        },
        [items, storeFilteredProducts]
    )

    const onSubmit = async (formValues: EstimateFormData) => {
        try {
            const isMember = formValues.isMember === 'true'
            const allMergedItems = items.map((item, i) => {
                const qty = formValues.items[i]?.qty ?? item.qty
                const description = formValues.items[i]?.description ?? item.description ?? ''
                const unitPrice = isMember ? item.unitPriceMember : item.unitPriceGeneral
                const amount = unitPrice * qty
                return { ...item, qty, description, amount }
            })
            const activeItems = allMergedItems.filter((item) => item.qty > 0).map((item, i) => ({ ...item, sortNo: i }))
            if (activeItems.length === 0) {
                toast({
                    title: '数量が1以上の品目を少なくとも1つ入力してください',
                    variant: 'destructive',
                    duration: 3000,
                })
                return
            }
            const groupExpandedItems = expandVariantGroupItems(activeItems, isMember)
            const finalItems = expandEachModeItems(groupExpandedItems, isMember)
            const mergedFreeItems = freeItems
                .map((item, i) => {
                    const productItemName = formValues.freeItems[i]?.productItemName ?? item.productItemName ?? ''
                    const isMaturity = productItemName === MATURITY_SERVICE_NAME
                    const isExecutionSurcharge = productItemName === EXECUTION_SURCHARGE_NAME
                    const description = isMaturity || isExecutionSurcharge
                        ? ''
                        : formValues.freeItems[i]?.description ?? item.description ?? ''
                    // 施行割増券は金額固定・編集不可のため、フォーム送信値に関わらず規定額を強制する
                    const unitPriceGeneral = isExecutionSurcharge
                        ? EXECUTION_SURCHARGE_AMOUNT
                        : formValues.freeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
                    const qty = formValues.freeItems[i]?.qty ?? item.qty
                    const amount = unitPriceGeneral * qty
                    return { ...item, productItemName, description, unitPriceGeneral, qty, amount }
                })
                .filter((it) => it.productItemName.trim().length > 0 && it.qty > 0)
                .map((it, i) => ({ ...it, sortNo: i }))
            const totals = calculateDocumentFormTotals(items, formValues.items, isMember, customer, freeItems, formValues.freeItems)
            const data = { ...formValues, ...totals, items: finalItems, freeItems: mergedFreeItems }
            await updateEstimate(estimateId, data)
            toast({ title: '更新しました', variant: 'success', duration: 2000 })
            await loadData()
        } catch (error) {
            handleSaveError(error)
        }
    }

    return { loading, customer, setCustomer, estimate, items, setItems, freeItems, setFreeItems, planId, handlePlanChange, onSubmit }
}

// -------------------------------------------------------
// 品目検索フック
// -------------------------------------------------------
export const useProductSearch = useDocumentProductSearch<EstimateItem>

// -------------------------------------------------------
// 明細操作フック
// -------------------------------------------------------
export const useEstimateItems = useDocumentItems<EstimateItem>

// -------------------------------------------------------
// 合計計算ユーティリティ
// -------------------------------------------------------
export const calculateTotals = calculateDocumentFormTotals
