import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { getInvoice, updateInvoice } from '@/lib/invoices'
import { getCustomer } from '@/lib/customers'
import { getProducts } from '@/lib/products'
import { InvoiceItem, InvoiceFreeItem } from '@/lib/invoices'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import { calculateDocumentFormTotals } from '@/lib/documentTotals'
import { useDocumentItems } from '@/hooks/useDocumentItems'
import { expandEachModeItems, expandVariantGroupItems, buildDocumentFreeItems, MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME, EXECUTION_SURCHARGE_NAME, EXECUTION_SURCHARGE_AMOUNT } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'


const FIXED_ROW_NAMES = [MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME, CANCELLATION_FEE_NAME]

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
                                productRowVariantId: primaryVariant ? String(primaryVariant.id) : null,
                                calcType: row.calcType,
                                sign,
                                description: product.defaultDescription ?? '',
                                unitPriceGeneral: primaryUnitPrice,
                                unitPriceMember: primaryUnitPrice,
                                qty: 0,
                                amount: 0,
                                sortNo: mergedItems.length,
                                productItem: { ...product },
                                productRow: row,
                                productRowVariant: primaryVariant,
                            } as InvoiceItem)
                        }
                    }
                    continue
                }
                const allExisting = existingItems.filter(
                    (item) =>
                        item.productItemId === product.id && !(item as any).productRowId
                )
                if (product.hasVariantGroups) {
                    const groupExisting = allExisting.filter((item) => (item as any).productVariantGroupId)
                    if (groupExisting.length > 0) {
                        const groupSelectionsMap: Record<string, string[]> = {}
                        for (const gi of groupExisting) {
                            const gid = String((gi as any).productVariantGroupId)
                            if (!groupSelectionsMap[gid]) groupSelectionsMap[gid] = []
                            if ((gi as any).multiSelectVariantIds) {
                                try {
                                    const ids: string[] = JSON.parse((gi as any).multiSelectVariantIds)
                                    groupSelectionsMap[gid].push(...ids)
                                } catch { /* ignore */ }
                            } else if (gi.productVariantId) {
                                groupSelectionsMap[gid].push(String(gi.productVariantId))
                            }
                        }
                        mergedItems.push({
                            productItemId: product.id,
                            description: product.defaultDescription ?? '',
                            unitPriceGeneral: groupExisting.reduce((s, gi) => s + gi.unitPriceGeneral * (gi.qty || 1), 0),
                            unitPriceMember: groupExisting.reduce((s, gi) => s + gi.unitPriceMember * (gi.qty || 1), 0),
                            qty: 1,
                            amount: 0,
                            sortNo: mergedItems.length,
                            productItem: { ...product },
                            groupSelections: JSON.stringify(groupSelectionsMap),
                        } as InvoiceItem)
                    } else {
                        mergedItems.push({
                            productItemId: product.id,
                            description: product.defaultDescription ?? '',
                            unitPriceGeneral: 0,
                            unitPriceMember: 0,
                            qty: 0,
                            amount: 0,
                            sortNo: mergedItems.length,
                            productItem: { ...product },
                        } as InvoiceItem)
                    }
                    continue
                }
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
                altarType: (invoiceData as any).altarType || '',
                ceilingHeight: (invoiceData as any).ceilingHeight || '',
                memberCardNote: customerData?.memberCardNote || '',
                estimateStaff: (invoiceData as any).estimateStaff || '',
                ceremonyStaff: (invoiceData as any).ceremonyStaff || '',
                transportStaff: (invoiceData as any).transportStaff || '',
                decorationStaff: (invoiceData as any).decorationStaff || '',
                returnStaff: (invoiceData as any).returnStaff || '',
                remarks: (invoiceData as any).remarks || '',
                // 生花代。未設定は空文字にする（0円との区別を保つため ?? で判定する）
                flowerFee: (invoiceData as any).flowerFee ?? '',
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
            const groupExpandedItems = expandVariantGroupItems(activeItems, isMember)
            const finalItems = expandEachModeItems(groupExpandedItems, isMember)
            const mergedFreeItems = freeItems
                .map((item, i) => {
                    const productItemName = formValues.freeItems[i]?.productItemName ?? item.productItemName ?? ''
                    const isFixed = FIXED_ROW_NAMES.includes(productItemName)
                    const description = isFixed
                        ? ''
                        : formValues.freeItems[i]?.description ?? item.description ?? ''
                    // 施行割増券は金額固定・編集不可のため、フォーム送信値に関わらず規定額を強制する
                    const unitPriceGeneral =
                        productItemName === EXECUTION_SURCHARGE_NAME
                            ? EXECUTION_SURCHARGE_AMOUNT
                            : formValues.freeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
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

    return { loading, customer, setCustomer, invoice, setInvoice, items, setItems, freeItems, setFreeItems, onSubmit }
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
