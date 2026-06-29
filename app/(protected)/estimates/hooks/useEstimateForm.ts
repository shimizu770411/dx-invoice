import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getEstimate, createEstimate, updateEstimate, Estimate, EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { getCustomer } from '@/lib/customers'
import { getProducts, ProductItem, ProductVariant } from '@/lib/products'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import { calculateDocumentFormTotals } from '@/lib/documentTotals'
import { useDocumentItems } from '@/hooks/useDocumentItems'
import { sortByProductItemId, expandEachModeItems, padDocumentFreeItems, buildDocumentFreeItems, MATURITY_SERVICE_NAME } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import {
    EstimateFormData,
    EstimateItemField,
    EstimateFreeItemField,
    DEFAULT_FORM_VALUES,
} from '../schemas/EstimateFormSchema'


// 商品マスタとは連動しない明細フリー行を、明細末尾に常時 5 行表示し、
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

            // 顧客の担当店舗でvariantを絞り込み（該当店舗 + 全店舗共通）
            // バリエーション0件の商品も表示する（価格は明細で個別に設定可能）
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = allProducts.map((product) => ({
                ...product,
                variants: product.variants.filter(
                    (v) => !v.storeId || (storeId && String(v.storeId) === storeId)
                ),
            }))

            // 並び順:
            //   1. 親祭壇（isSetParent=true）を sortNo 順
            //   2. 一般商品（isSetParent=false かつ isSetChild=false）を sortNo 順
            //   3. 子商品（isSetChild=true）は親の直後に挿入（初期は qty=0）
            const parents = filteredProducts.filter((p: any) => p.isSetParent)
            const normals = filteredProducts.filter((p: any) => !p.isSetParent && !p.isSetChild)
            const childMap = new Map<string, any>()
            filteredProducts.forEach((p: any) => {
                if (p.isSetChild) childMap.set(String(p.id), p)
            })

            const buildItems = (product: any, startSortNo: number): EstimateItem[] => {
                // 複数行構成商品: ProductRow ごとに1行ずつ展開（初期は qty=0）
                if (product.isMultiRow && product.rows && product.rows.length > 0) {
                    return expandMultiRowToItems<EstimateItem>(
                        product,
                        startSortNo,
                        product.defaultDescription ?? ''
                    ).map((it) => ({ ...it, qty: 0, amount: 0 }))
                }
                const firstVariant = product.variants[0] ?? null
                return [
                    {
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
                    } as EstimateItem,
                ]
            }

            // 商品マスタの sortNo 順にすべて追加（重複なし）
            const ordered: EstimateItem[] = []
            const addedIds = new Set<string>()
            for (const product of filteredProducts) {
                const key = String(product.id)
                if (addedIds.has(key)) continue
                ordered.push(...buildItems(product, ordered.length))
                addedIds.add(key)
            }

            const initialItems = ordered
            setItems(initialItems)

            const initialFreeItems = padDocumentFreeItems<EstimateFreeItem>([], [MATURITY_SERVICE_NAME])
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
            const finalItems = expandEachModeItems(activeItems, isMember)
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

            // 顧客の担当店舗でvariantを絞り込み（該当店舗 + 全店舗共通）
            // バリエーション0件の商品も表示する（価格は明細で個別に設定可能）
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = allProducts.map((product) => ({
                ...product,
                variants: product.variants.filter(
                    (v) => !v.storeId || (storeId && String(v.storeId) === storeId)
                ),
            }))

            const buildItems = (product: any, startSortNo: number): EstimateItem[] => {
                // 複数行構成商品: ProductRow ごとに、既存明細とマージしながら展開
                // hasReturn=true の行は加算/減算の2行に展開
                if (product.isMultiRow && product.rows && product.rows.length > 0) {
                    const out: EstimateItem[] = []
                    let cursor = startSortNo
                    for (const row of product.rows as any[]) {
                        const def =
                            row.variants?.find((v: any) => v.isDefault) ?? row.variants?.[0]
                        const unitPrice = def?.unitPrice ?? 0
                        const signs: (1 | -1)[] = row.hasReturn ? [1, -1] : [1]
                        for (const sign of signs) {
                            const existing = existingItems.find(
                                (item) =>
                                    String((item as any).productRowId ?? '') === String(row.id) &&
                                    Number((item as any).sign ?? 1) === sign
                            )
                            if (existing) {
                                out.push({
                                    ...existing,
                                    productItem: { ...product },
                                    productRow: row,
                                } as EstimateItem)
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
                    (item) =>
                        item.productItemId === product.id && !(item as any).productRowId
                )
                if (allExisting.length > 0) {
                    // EACH モード (isMultiSelect=true, multiSelectMerge=false): 複数EACH行を1スロットに集約
                    if ((product as any).isMultiSelect && (product as any).multiSelectMerge === false && allExisting.length > 1) {
                        const variantIds = allExisting
                            .map((it: any) => String(it.productVariantId))
                            .filter(Boolean)
                        const selectedVariants = (product.variants || []).filter((v: any) =>
                            variantIds.includes(String(v.id))
                        )
                        const totalGeneral = selectedVariants.reduce((s: number, v: any) => s + v.priceGeneral, 0)
                        const totalMember = selectedVariants.reduce((s: number, v: any) => s + v.priceMember, 0)
                        return [{
                            ...allExisting[0],
                            productItem: { ...product },
                            multiSelectVariantIds: JSON.stringify(variantIds),
                            unitPriceGeneral: totalGeneral,
                            unitPriceMember: totalMember,
                        } as EstimateItem]
                    }
                    return [{ ...allExisting[0], productItem: { ...product } }]
                }
                const firstVariant = product.variants[0] ?? null
                return [
                    {
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
                    } as EstimateItem,
                ]
            }

            // 商品マスタの sortNo 順にすべて追加（重複なし）
            const mergedItems: EstimateItem[] = []
            const addedIds = new Set<string>()
            for (const product of filteredProducts) {
                const key = String(product.id)
                if (addedIds.has(key)) continue
                mergedItems.push(...buildItems(product, mergedItems.length))
                addedIds.add(key)
            }

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
            const finalItems = expandEachModeItems(activeItems, isMember)
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
