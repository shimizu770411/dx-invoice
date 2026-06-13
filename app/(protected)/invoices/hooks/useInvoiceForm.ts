import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getInvoice, createInvoice, updateInvoice, createInvoiceFromEstimate } from '@/lib/invoices'
import { getCustomer } from '@/lib/customers'
import { getEstimates } from '@/lib/estimates'
import { getProducts, ProductItem, ProductVariant } from '@/lib/products'
import { InvoiceItem, InvoiceFreeItem } from '@/lib/invoices'
import { scopeApplies } from '@/lib/productScope'
import { expandMultiRowToItems, computeMultiRowAmount } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import {
    InvoiceFormData,
    InvoiceItemField,
    InvoiceFreeItemField,
    DEFAULT_INVOICE_FORM_VALUES,
} from '../schemas/InvoiceFormSchema'

const sortByProductItemId = (arr: InvoiceItem[]): InvoiceItem[] =>
    arr.slice().sort((a, b) => {
        if (a.productItemId == null) return 1
        if (b.productItemId == null) return -1
        return Number(a.productItemId) - Number(b.productItemId)
    })

// 商品マスタとは連動しない明細フリー行を、明細末尾に常時 5 行表示し、
// その後に固定の「満期サービス」行（6行目）「解約手数料」行（7行目）を続ける。
const FIXED_FREE_ROW_COUNT = 5
export const MATURITY_SERVICE_NAME = '満期サービス'
export const CANCELLATION_FEE_NAME = '解約手数料'
const FIXED_ROW_NAMES = [MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME]

const padInvoiceFreeItems = (arr: InvoiceFreeItem[]): InvoiceFreeItem[] => {
    const maturity = arr.find((it) => it.productItemName === MATURITY_SERVICE_NAME)
    const cancellationFee = arr.find((it) => it.productItemName === CANCELLATION_FEE_NAME)
    const others = arr.filter((it) => !FIXED_ROW_NAMES.includes(it.productItemName))

    const padded: InvoiceFreeItem[] = others.slice()
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

    // 7 行目: 解約手数料（既存があれば引継ぎ、無ければ初期値）。摘要は表示しないので常に空に。
    padded.push(
        cancellationFee
            ? { ...cancellationFee, description: '', sortNo: FIXED_FREE_ROW_COUNT + 1 }
            : {
                  productItemName: CANCELLATION_FEE_NAME,
                  description: '',
                  unitPriceGeneral: 0,
                  qty: 0,
                  amount: 0,
                  sortNo: FIXED_FREE_ROW_COUNT + 1,
              }
    )

    return padded
}

// -------------------------------------------------------
// 新規作成フック（customerId から）
// -------------------------------------------------------
export function useInvoiceCreate(customerId: string, reset: UseFormReset<InvoiceFormData>) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [estimates, setEstimates] = useState<any[]>([])
    const [items, setItems] = useState<InvoiceItem[]>([])
    const [freeItems, setFreeItems] = useState<InvoiceFreeItem[]>([])
    const [copyingFrom, setCopyingFrom] = useState(false)

    const loadData = useCallback(async () => {
        try {
            const [customerData, estimatesData, allProducts] = await Promise.all([
                getCustomer(customerId),
                getEstimates(customerId),
                getProducts(),
            ])
            setCustomer(customerData)
            setEstimates(estimatesData)

            // 顧客の担当店舗でvariantを絞り込み（該当店舗 + 全店舗共通）
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = allProducts.map((product) => ({
                ...product,
                variants: product.variants.filter(
                    (v) => !v.storeId || (storeId && String(v.storeId) === storeId)
                ),
            }))

            const initialItems: InvoiceItem[] = []
            for (const product of filteredProducts as any[]) {
                // 複数行構成商品: ProductRow ごとに1行ずつ展開（初期は qty=0）
                if (product.isMultiRow && product.rows && product.rows.length > 0) {
                    const expanded = expandMultiRowToItems<InvoiceItem>(
                        product,
                        initialItems.length,
                        product.defaultDescription ?? ''
                    ).map((it) => ({ ...it, qty: 0, amount: 0 }))
                    initialItems.push(...expanded)
                    continue
                }
                const firstVariant = product.variants[0] ?? null
                initialItems.push({
                    productItemId: product.id,
                    productVariantId: firstVariant?.id ?? undefined,
                    description: product.defaultDescription ?? '',
                    unitPriceGeneral: firstVariant?.priceGeneral || 0,
                    unitPriceMember: firstVariant?.priceMember || 0,
                    qty: 0,
                    amount: 0,
                    sortNo: initialItems.length,
                    productItem: { ...product },
                    productVariant: firstVariant,
                })
            }
            setItems(initialItems)

            const initialFreeItems = padInvoiceFreeItems([])
            setFreeItems(initialFreeItems)

            reset({
                ...DEFAULT_INVOICE_FORM_VALUES,
                items: initialItems.map((item) => ({
                    qty: item.qty,
                    description: item.description || '',
                })),
                freeItems: initialFreeItems.map((item) => ({
                    productItemName: item.productItemName || '',
                    description: item.description || '',
                    unitPriceGeneral: item.unitPriceGeneral,
                    qty: item.qty,
                })),
            })
        } catch (error) {
            console.error('Failed to load data:', error)
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

    const handleCopyFromEstimate = async (estimateId: string) => {
        setCopyingFrom(true)
        try {
            const newInvoice = await createInvoiceFromEstimate(customerId, estimateId)
            toast({ title: '見積からコピーしました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/invoices/${newInvoice.id}`)
        } catch (error) {
            console.error('Failed to copy from estimate:', error)
            toast({ title: '見積からのコピーに失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setCopyingFrom(false)
        }
    }

    const onSubmit = async (formValues: InvoiceFormData) => {
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
                    const isFixed = FIXED_ROW_NAMES.includes(productItemName)
                    const description = isFixed
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
            const totals = calculateInvoiceTotals(
                items,
                formValues.items,
                isMember,
                customer,
                freeItems,
                formValues.freeItems
            )
            const data = { ...formValues, ...totals, items: activeItems, freeItems: mergedFreeItems }
            const created = await createInvoice(customerId, data)
            toast({ title: '登録しました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/invoices/${created.id}`)
        } catch (error) {
            console.error('Failed to create:', error)
            toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    return {
        loading,
        customer,
        estimates,
        items,
        setItems,
        freeItems,
        setFreeItems,
        onSubmit,
        handleCopyFromEstimate,
        copyingFrom,
    }
}

// -------------------------------------------------------
// 編集フック（invoiceId から）
// -------------------------------------------------------
export function useInvoiceEdit(invoiceId: string, reset: UseFormReset<InvoiceFormData>) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [invoice, setInvoice] = useState<any>(null)
    const [items, setItems] = useState<InvoiceItem[]>([])
    const [freeItems, setFreeItems] = useState<InvoiceFreeItem[]>([])

    const loadData = useCallback(async () => {
        try {
            const [invoiceData, allProducts] = await Promise.all([getInvoice(invoiceId), getProducts()])
            setInvoice(invoiceData)
            const existingItems: InvoiceItem[] = invoiceData.items || []

            // 顧客情報を先に取得して担当店舗を確定
            const customerData = await getCustomer(invoiceData.customerId)
            setCustomer(customerData)

            // 顧客の担当店舗でvariantを絞り込み（該当店舗 + 全店舗共通）
            const storeId = customerData?.storeId ? String(customerData.storeId) : null
            const filteredProducts = allProducts.map((product) => ({
                ...product,
                variants: product.variants.filter(
                    (v) => !v.storeId || (storeId && String(v.storeId) === storeId)
                ),
            }))

            // 全アクティブ品目と既存請求明細をマージ
            const mergedItems: InvoiceItem[] = []
            for (const product of filteredProducts as any[]) {
                // 複数行構成商品: ProductRow ごとに既存明細とマージ
                // hasReturn=true の行は加算/減算の2行に展開
                if (product.isMultiRow && product.rows && product.rows.length > 0) {
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
                                mergedItems.push({
                                    ...existing,
                                    productItem: { ...product },
                                    productRow: row,
                                } as InvoiceItem)
                                continue
                            }
                            mergedItems.push({
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
                                sortNo: mergedItems.length,
                                productItem: { ...product },
                                productRow: row,
                                productRowVariant: def,
                            } as InvoiceItem)
                        }
                    }
                    continue
                }
                const existing = existingItems.find(
                    (item) =>
                        item.productItemId === product.id && !(item as any).productRowId
                )
                if (existing) {
                    mergedItems.push({ ...existing, productItem: { ...product } })
                    continue
                }
                const firstVariant = product.variants[0] ?? null
                mergedItems.push({
                    productItemId: product.id,
                    productVariantId: firstVariant?.id ?? undefined,
                    description: product.defaultDescription ?? '',
                    unitPriceGeneral: firstVariant?.priceGeneral || 0,
                    unitPriceMember: firstVariant?.priceMember || 0,
                    qty: 0,
                    amount: 0,
                    sortNo: mergedItems.length,
                    productItem: { ...product },
                    productVariant: firstVariant,
                })
            }

            const loadedFreeItems: InvoiceFreeItem[] = (invoiceData as any).freeItems || []
            const paddedFreeItems = padInvoiceFreeItems(loadedFreeItems)
            setItems(mergedItems)
            setFreeItems(paddedFreeItems)

            reset({
                docNo: invoiceData.docNo || '',
                status: invoiceData.status || 'DRAFT',
                isMember: String((invoiceData as any).isMember ?? false),
                cremationProcessType: (invoiceData as any).cremationProcessType || '',
                altarPlaceType: (invoiceData as any).altarPlaceType || '',
                altarPlaceOther: (invoiceData as any).altarPlaceOther || '',
                ceilingHeight: (invoiceData as any).ceilingHeight || '',
                estimateStaff: (invoiceData as any).estimateStaff || '',
                ceremonyStaff: (invoiceData as any).ceremonyStaff || '',
                transportStaff: (invoiceData as any).transportStaff || '',
                decorationStaff: (invoiceData as any).decorationStaff || '',
                returnStaff: (invoiceData as any).returnStaff || '',
                items: mergedItems.map((item) => ({
                    qty: item.qty,
                    description: item.description || '',
                })),
                freeItems: paddedFreeItems.map((item) => ({
                    productItemName: item.productItemName || '',
                    description: item.description || '',
                    unitPriceGeneral: item.unitPriceGeneral,
                    qty: item.qty,
                })),
            })
        } catch (error) {
            console.error('Failed to load invoice:', error)
            toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setLoading(false)
        }
    }, [invoiceId, reset])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!loading && !invoice) {
            toast({ title: '請求書データが取得できませんでした', variant: 'destructive', duration: 3000 })
            router.push('/cases')
        }
    }, [loading, invoice, router])

    const onSubmit = async (formValues: InvoiceFormData) => {
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
                    const isFixed = FIXED_ROW_NAMES.includes(productItemName)
                    const description = isFixed
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
            const totals = calculateInvoiceTotals(
                items,
                formValues.items,
                isMember,
                customer,
                freeItems,
                formValues.freeItems
            )
            const data = { ...formValues, ...totals, items: activeItems, freeItems: mergedFreeItems }
            await updateInvoice(invoiceId, data)
            toast({ title: '更新しました', variant: 'success', duration: 2000 })
            await loadData()
        } catch (error) {
            console.error('Failed to update:', error)
            toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    return { loading, customer, invoice, items, setItems, freeItems, setFreeItems, onSubmit }
}

// -------------------------------------------------------
// 品目検索フック
// -------------------------------------------------------
export function useInvoiceProductSearch(
    items: InvoiceItem[],
    setItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>,
    appendItemField: (val: InvoiceItemField) => void,
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
            const expanded = expandMultiRowToItems<InvoiceItem>(
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

        const newItem: InvoiceItem = {
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
export function useInvoiceItems(
    items: InvoiceItem[],
    setItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>,
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
export function calculateInvoiceTotals(
    items: InvoiceItem[],
    itemFields: InvoiceItemField[] | undefined,
    isMember: boolean,
    customer: any,
    freeItems?: InvoiceFreeItem[],
    freeItemFields?: InvoiceFreeItemField[]
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
        if (isSetIncluded || isServiceIncluded || isMaturityServiceIncluded) return sum
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
