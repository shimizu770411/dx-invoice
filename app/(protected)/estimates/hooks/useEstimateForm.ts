import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getEstimate, createEstimate, updateEstimate, Estimate, EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { getCustomer } from '@/lib/customers'
import { getProducts, ProductItem } from '@/lib/products'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import { calculateDocumentFormTotals } from '@/lib/documentTotals'
import { useDocumentItems } from '@/hooks/useDocumentItems'
import { expandEachModeItems, expandVariantGroupItems, buildDocumentFreeItems, MATURITY_SERVICE_NAME } from '@/lib/documentUtils'
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

// 新規作成時: 商品マスタ → 初期明細行（全て qty=0）
function buildNewEstimateItems(filteredProducts: ProductItem[]): EstimateItem[] {
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
            const firstVariant = product.variants[0] ?? null
            ordered.push({
                productItemId: product.id,
                productVariantId: firstVariant?.id ?? undefined,
                description: (product as any).defaultDescription ?? '',
                unitPriceGeneral: (firstVariant as any)?.priceGeneral || 0,
                unitPriceMember: (firstVariant as any)?.priceMember || 0,
                qty: 0,
                amount: 0,
                sortNo: ordered.length,
                productItem: { ...product },
                productVariant: firstVariant,
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
    existingItems: EstimateItem[]
): EstimateItem[] {
    if (product.isMultiRow && product.rows?.length > 0) {
        const out: EstimateItem[] = []
        let cursor = startSortNo
        for (const row of product.rows as any[]) {
            const def = row.variants?.find((v: any) => v.isDefault) ?? row.variants?.[0]
            const unitPrice = def?.unitPrice ?? 0
            const signs: (1 | -1)[] = row.hasReturn ? [1, -1] : [1]
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
                        productRowVariantId: def ? String(def.id) : null,
                        calcType: row.calcType,
                        sign,
                        description: product.defaultDescription ?? '',
                        unitPriceGeneral: unitPrice,
                        unitPriceMember: unitPrice,
                        qty: 0,
                        amount: 0,
                        sortNo: cursor,
                        productItem: { ...product },
                        productRow: row,
                        productRowVariant: def,
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
        return [{ ...allExisting[0], productItem: { ...product } }]
    }
    const firstVariant = product.variants[0] ?? null
    return [{
        productItemId: product.id,
        productVariantId: firstVariant?.id ?? undefined,
        description: product.defaultDescription ?? '',
        unitPriceGeneral: firstVariant?.priceGeneral || 0,
        unitPriceMember: firstVariant?.priceMember || 0,
        qty: 0,
        amount: 0,
        sortNo: startSortNo,
        productItem: { ...product },
        productVariant: firstVariant,
    } as EstimateItem]
}

// 編集時: 全商品 × 既存明細 → マージ済み明細リスト
function buildMergedEstimateItems(filteredProducts: ProductItem[], existingItems: EstimateItem[]): EstimateItem[] {
    const mergedItems: EstimateItem[] = []
    const addedIds = new Set<string>()
    for (const product of filteredProducts) {
        const key = String(product.id)
        if (addedIds.has(key)) continue
        mergedItems.push(...buildEstimateItemsForProduct(product, mergedItems.length, existingItems))
        addedIds.add(key)
    }
    return mergedItems
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

    const loadData = useCallback(async () => {
        try {
            const [customerData, allProducts] = await Promise.all([getCustomer(customerId), getProducts()])
            setCustomer(customerData)
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = filterProductsByStore(allProducts, storeId)
            const initialItems = buildNewEstimateItems(filteredProducts)
            setItems(initialItems)
            const initialFreeItems = buildDocumentFreeItems<EstimateFreeItem>([], initialItems, [MATURITY_SERVICE_NAME], { ignoreQtyFilter: true })
            setFreeItems(initialFreeItems)
            reset({
                ...DEFAULT_FORM_VALUES,
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
                    const description = isMaturity
                        ? ''
                        : formValues.freeItems[i]?.description ?? item.description ?? ''
                    const unitPriceGeneral =
                        formValues.freeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
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

    return { loading, customer, estimate: null as Estimate | null, items, setItems, freeItems, setFreeItems, onSubmit }
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

    const loadData = useCallback(async () => {
        try {
            const [estimateData, allProducts] = await Promise.all([getEstimate(estimateId), getProducts()])
            setEstimate(estimateData)
            const existingItems: EstimateItem[] = estimateData.items || []
            const customerData = await getCustomer(estimateData.customerId)
            setCustomer(customerData)
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = filterProductsByStore(allProducts, storeId)
            const mergedItems = buildMergedEstimateItems(filteredProducts, existingItems)
            const loadedFreeItems: EstimateFreeItem[] = (estimateData as any).freeItems || []
            const paddedFreeItems = buildDocumentFreeItems(loadedFreeItems, mergedItems, [MATURITY_SERVICE_NAME])
            setItems(mergedItems)
            setFreeItems(paddedFreeItems)
            reset({
                docNo: estimateData.docNo || '',
                status: estimateData.status || 'DRAFT',
                isMember: String((estimateData as any).isMember ?? false),
                cremationProcessType: (estimateData as any).cremationProcessType || '',
                altarPlaceType: (estimateData as any).altarPlaceType || '',
                altarPlaceOther: (estimateData as any).altarPlaceOther || '',
                ceilingHeight: (estimateData as any).ceilingHeight || '',
                preConsultStaff: (estimateData as any).preConsultStaff || '',
                estimateStaff: (estimateData as any).estimateStaff || '',
                ceremonyStaff: (estimateData as any).ceremonyStaff || '',
                transportStaff: (estimateData as any).transportStaff || '',
                decorationStaff: (estimateData as any).decorationStaff || '',
                returnStaff: (estimateData as any).returnStaff || '',
                remarks: (estimateData as any).remarks || '',
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
                    const description = isMaturity
                        ? ''
                        : formValues.freeItems[i]?.description ?? item.description ?? ''
                    const unitPriceGeneral =
                        formValues.freeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
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

    return { loading, customer, estimate, items, setItems, freeItems, setFreeItems, onSubmit }
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
