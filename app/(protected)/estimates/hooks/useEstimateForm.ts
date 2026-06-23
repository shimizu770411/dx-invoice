import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getEstimate, createEstimate, updateEstimate, Estimate, EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { getCustomer } from '@/lib/customers'
import { getProducts, ProductItem, ProductVariant } from '@/lib/products'
import { scopeApplies } from '@/lib/productScope'
import { expandMultiRowToItems, computeMultiRowAmount } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import {
    EstimateFormData,
    EstimateItemField,
    EstimateFreeItemField,
    DEFAULT_FORM_VALUES,
} from '../schemas/EstimateFormSchema'

const sortByProductItemId = (arr: EstimateItem[]): EstimateItem[] =>
    arr.slice().sort((a, b) => {
        if (a.productItemId == null) return 1
        if (b.productItemId == null) return -1
        return Number(a.productItemId) - Number(b.productItemId)
    })

// 商品マスタとは連動しない明細フリー行を、明細末尾に常時 5 行表示し、
// その後に固定の「満期サービス」行（6行目）を続ける。
const FIXED_FREE_ROW_COUNT = 5
export const MATURITY_SERVICE_NAME = '満期サービス'

const padFreeItems = (arr: EstimateFreeItem[]): EstimateFreeItem[] => {
    // 既存の満期サービス行を分離（あれば後で末尾に再配置）
    const maturity = arr.find((it) => it.productItemName === MATURITY_SERVICE_NAME)
    const others = arr.filter((it) => it.productItemName !== MATURITY_SERVICE_NAME)

    // 通常フリー行を 5 行に揃える
    const padded: EstimateFreeItem[] = others.slice()
    while (padded.length < FIXED_FREE_ROW_COUNT) {
        padded.push({
            productItemName: '',
            description: '',
            unitPriceGeneral: 0,
            qty: 0,
            amount: 0,
            sortNo: padded.length,
        })
    }

    // 6 行目: 満期サービス（既存があれば引継ぎ、無ければ初期値）。摘要は表示しないので常に空に。
    padded.push(
        maturity
            ? { ...maturity, description: '', sortNo: FIXED_FREE_ROW_COUNT }
            : {
                  productItemName: MATURITY_SERVICE_NAME,
                  description: '',
                  unitPriceGeneral: 0,
                  qty: 0,
                  amount: 0,
                  sortNo: FIXED_FREE_ROW_COUNT,
              }
    )

    return padded
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

            const initialFreeItems = padFreeItems([])
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
            console.error('Failed to load customer:', error)
            toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: 3000 })
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
            const totals = calculateTotals(items, formValues.items, isMember, customer, freeItems, formValues.freeItems)
            const data = { ...formValues, ...totals, items: activeItems, freeItems: mergedFreeItems }
            const created = await createEstimate(customerId, data)
            toast({ title: '登録しました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/estimates/${created.id}`)
        } catch (error) {
            console.error('Failed to create:', error)
            toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
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
                const existing = existingItems.find(
                    (item) =>
                        item.productItemId === product.id && !(item as any).productRowId
                )
                if (existing) {
                    return [{ ...existing, productItem: { ...product } }]
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

            // 親付き/親なしを分離
            const standaloneFreeItems = loadedFreeItems.filter((fi) => !fi.parentProductItemId)
            const parentLinkedFreeItems = loadedFreeItems.filter((fi) => fi.parentProductItemId)

            // 親なしを 5 行に padding（満期サービスは末尾）
            const paddedStandaloneFreeItems = padFreeItems(standaloneFreeItems)

            // canAddFreeRow=ON で見積に含まれる商品で、まだ親付きフリー行がないものに対し空行を自動生成
            const existingParentIds = new Set(
                parentLinkedFreeItems.map((fi) => String(fi.parentProductItemId))
            )
            const autoGeneratedFreeItems: EstimateFreeItem[] = []
            for (const item of mergedItems) {
                if (!item.qty || item.qty <= 0) continue
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
                } as EstimateFreeItem)
            }

            const paddedFreeItems: EstimateFreeItem[] = [
                ...paddedStandaloneFreeItems,
                ...parentLinkedFreeItems,
                ...autoGeneratedFreeItems,
            ]
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
            console.error('Failed to load estimate:', error)
            toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: 3000 })
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
            const totals = calculateTotals(items, formValues.items, isMember, customer, freeItems, formValues.freeItems)
            const data = { ...formValues, ...totals, items: activeItems, freeItems: mergedFreeItems }
            await updateEstimate(estimateId, data)
            toast({ title: '更新しました', variant: 'success', duration: 2000 })
            await loadData()
        } catch (error) {
            console.error('Failed to update:', error)
            toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    return { loading, customer, estimate, items, setItems, freeItems, setFreeItems, onSubmit }
}

// -------------------------------------------------------
// 品目検索フック
// -------------------------------------------------------
export function useProductSearch(
    items: EstimateItem[],
    setItems: React.Dispatch<React.SetStateAction<EstimateItem[]>>,
    appendItemField: (val: { qty: number; description: string }) => void,
    moveItemField: (from: number, to: number) => void
) {
    const [products, setProducts] = useState<ProductItem[]>([])
    const [searchProductName, setSearchProductName] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

    const handleSearchProducts = async (query?: string) => {
        try {
            const results = await getProducts(query !== undefined ? query : searchProductName)
            setProducts(results)
        } catch (error) {
            console.error('Failed to search products:', error)
            toast({ title: '品目の検索に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    const handleSelectProduct = (product: ProductItem) => {
        setSelectedProduct(product)
        setSelectedVariant(product.variants.length > 0 ? product.variants[0] : null)
    }

    const handleAddItem = () => {
        if (!selectedProduct) {
            toast({ title: '商品を選択してください', variant: 'destructive', duration: 3000 })
            return
        }

        const defaultDescription = selectedProduct.defaultDescription ?? ''

        // 複数行構成商品: ProductRow ごとに1行ずつ展開
        if (selectedProduct.isMultiRow) {
            const expanded = expandMultiRowToItems<EstimateItem>(
                selectedProduct,
                items.length,
                defaultDescription
            )
            if (expanded.length === 0) {
                toast({
                    title: 'この商品には明細行が登録されていません。商品マスタで設定してください。',
                    variant: 'destructive',
                    duration: 4000,
                })
                return
            }
            const sortedItems = sortByProductItemId([...items, ...expanded])
            setItems(sortedItems)
            expanded.forEach((e) =>
                appendItemField({ qty: e.qty ?? 1, description: e.description ?? '' })
            )
            setSelectedProduct(null)
            setSelectedVariant(null)
            setSearchProductName('')
            setProducts([])
            return
        }

        if (!selectedVariant) {
            toast({ title: '種類を選択してください', variant: 'destructive', duration: 3000 })
            return
        }

        const newItem: EstimateItem = {
            productItemId: selectedProduct.id,
            productVariantId: selectedVariant.id,
            description: defaultDescription,
            unitPriceGeneral: selectedVariant.priceGeneral,
            unitPriceMember: selectedVariant.priceMember,
            qty: 1,
            amount: selectedVariant.priceGeneral,
            sortNo: items.length,
            productItem: selectedProduct,
            productVariant: selectedVariant,
        }

        const sortedItems = sortByProductItemId([...items, newItem])
        const oldIndex = items.length
        const newIndex = sortedItems.findIndex(
            (item) => item.productItemId === newItem.productItemId && item.productVariantId === newItem.productVariantId
        )
        setItems(sortedItems)
        appendItemField({ qty: 1, description: defaultDescription })
        if (newIndex !== oldIndex) {
            moveItemField(oldIndex, newIndex)
        }
        setSelectedProduct(null)
        setSelectedVariant(null)
        setSearchProductName('')
        setProducts([])
    }

    return {
        products,
        searchProductName,
        setSearchProductName,
        selectedProduct,
        selectedVariant,
        setSelectedVariant,
        handleSearchProducts,
        handleSelectProduct,
        clearSelectedProduct: () => {
            setSelectedProduct(null)
            setSelectedVariant(null)
        },
        handleAddItem,
    }
}

// -------------------------------------------------------
// 明細操作フック
// -------------------------------------------------------
export function useEstimateItems(
    items: EstimateItem[],
    setItems: React.Dispatch<React.SetStateAction<EstimateItem[]>>,
    removeItemField: (index: number) => void
) {
    const handleRemoveItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index))
        removeItemField(index)
    }

    return { handleRemoveItem }
}

// -------------------------------------------------------
// 合計計算ユーティリティ
// -------------------------------------------------------
export function calculateTotals(
    items: EstimateItem[],
    itemFields: EstimateItemField[] | undefined,
    isMember: boolean,
    customer: any,
    freeItems?: EstimateFreeItem[],
    freeItemFields?: EstimateFreeItemField[]
) {
    const regularSubtotal = items.reduce((sum, item, i) => {
        const qty = itemFields?.[i]?.qty ?? item.qty
        const pi = (item as any)?.productItem
        const pv = (item as any)?.productVariant
        // 子商品 + 初期セット種類 + setableScope が現在モードに該当: 合計対象外
        const isSetIncluded =
            pi?.isSetChild &&
            pv?.isDefaultSet &&
            scopeApplies(pi?.setableScope, isMember)
        // サービス品フラグON + serviceableScope が現在モードに該当: 合計対象外
        const isServiceIncluded =
            (item as any)?.isService && scopeApplies(pi?.serviceableScope, isMember)
        // 満期サービスフラグON + 商品の満期サービス可否が「可」: 合計対象外
        const isMaturityServiceIncluded =
            (item as any)?.isMaturityService && pi?.isMaturityServiceable
        // 任意セット扱い (adhocSetScope) が現在モードに該当: 合計対象外
        const adhocScope = (item as any)?.adhocSetScope
        const isAdhocSetIncluded =
            adhocScope === 'BOTH' ||
            (adhocScope === 'MEMBER_ONLY' && isMember) ||
            (adhocScope === 'GENERAL_ONLY' && !isMember)
        if (isSetIncluded || isServiceIncluded || isMaturityServiceIncluded || isAdhocSetIncluded)
            return sum
        // 複数行構成商品: calcType と sign を考慮（一般/会員ともに同一単価）
        if ((item as any)?.productRowId && (item as any)?.calcType) {
            return (
                sum +
                computeMultiRowAmount({
                    calcType: (item as any).calcType,
                    sign: (item as any).sign,
                    unitPrice: item.unitPriceGeneral,
                    qty,
                })
            )
        }
        const unitPrice = isMember ? item.unitPriceMember : item.unitPriceGeneral
        return sum + unitPrice * qty
    }, 0)
    const freeSubtotal = (freeItems || []).reduce((sum, item, i) => {
        const qty = freeItemFields?.[i]?.qty ?? item.qty
        const unitPrice = freeItemFields?.[i]?.unitPriceGeneral ?? item.unitPriceGeneral
        return sum + unitPrice * qty
    }, 0)
    const subtotal = regularSubtotal + freeSubtotal
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax
    const membershipPaidAmount =
        customer?.memberships?.reduce((sum: number, m: any) => sum + (m.paymentAmount || 0), 0) || 0
    const grandTotal = Math.max(0, total - membershipPaidAmount)
    return { subtotal, tax, total, membershipPaidAmount, grandTotal }
}
