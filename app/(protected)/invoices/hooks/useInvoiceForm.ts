import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getInvoice, createInvoice, updateInvoice, createInvoiceFromEstimate } from '@/lib/invoices'
import { getCustomer } from '@/lib/customers'
import { getEstimates } from '@/lib/estimates'
import { getProducts, ProductItem, ProductVariant } from '@/lib/products'
import { InvoiceItem, InvoiceFreeItem } from '@/lib/invoices'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError, handleOperationError } from '@/lib/errorHandler'
import { calculateDocumentFormTotals } from '@/lib/documentTotals'
import { useDocumentItems } from '@/hooks/useDocumentItems'
import { sortByProductItemId, expandEachModeItems, padDocumentFreeItems, buildDocumentFreeItems, MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import {
    InvoiceFormData,
    InvoiceItemField,
    InvoiceFreeItemField,
    DEFAULT_INVOICE_FORM_VALUES,
} from '../schemas/InvoiceFormSchema'


const FIXED_ROW_NAMES = [MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME]

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

            const initialFreeItems = padDocumentFreeItems<InvoiceFreeItem>([], [MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME])
            setFreeItems(initialFreeItems)

            reset({
                ...DEFAULT_INVOICE_FORM_VALUES,
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

    const handleCopyFromEstimate = async (estimateId: string) => {
        setCopyingFrom(true)
        try {
            const newInvoice = await createInvoiceFromEstimate(customerId, estimateId)
            toast({ title: '見積からコピーしました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/invoices/${newInvoice.id}`)
        } catch (error) {
            handleOperationError(error, '見積からのコピーに失敗しました')
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
            const finalItems = expandEachModeItems(activeItems, isMember)
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
            const totals = calculateDocumentFormTotals(
                items,
                formValues.items,
                isMember,
                customer,
                freeItems,
                formValues.freeItems
            )
            const data = { ...formValues, ...totals, items: finalItems, freeItems: mergedFreeItems }
            const created = await createInvoice(customerId, data)
            toast({ title: '登録しました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/invoices/${created.id}`)
        } catch (error) {
            handleSaveError(error)
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
                        mergedItems.push({
                            ...allExisting[0],
                            productItem: { ...product },
                            multiSelectVariantIds: JSON.stringify(variantIds),
                            unitPriceGeneral: totalGeneral,
                            unitPriceMember: totalMember,
                        } as any)
                    } else {
                        mergedItems.push({ ...allExisting[0], productItem: { ...product } })
                    }
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

            const paddedFreeItems = buildDocumentFreeItems(loadedFreeItems, mergedItems, [MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME])
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
            const finalItems = expandEachModeItems(activeItems, isMember)
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
            const totals = calculateDocumentFormTotals(
                items,
                formValues.items,
                isMember,
                customer,
                freeItems,
                formValues.freeItems
            )
            const data = { ...formValues, ...totals, items: finalItems, freeItems: mergedFreeItems }
            await updateInvoice(invoiceId, data)
            toast({ title: '更新しました', variant: 'success', duration: 2000 })
            await loadData()
        } catch (error) {
            handleSaveError(error)
        }
    }

    return { loading, customer, invoice, items, setItems, freeItems, setFreeItems, onSubmit }
}

// -------------------------------------------------------
// 品目検索フック
// -------------------------------------------------------
export const useInvoiceProductSearch = useDocumentProductSearch<InvoiceItem>

// -------------------------------------------------------
// 明細操作フック
// -------------------------------------------------------
export const useInvoiceItems = useDocumentItems<InvoiceItem>

// -------------------------------------------------------
// 合計計算ユーティリティ
// -------------------------------------------------------
export const calculateInvoiceTotals = calculateDocumentFormTotals
