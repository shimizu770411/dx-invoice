import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { getInvoice, updateInvoice } from '@/lib/invoices'
import { getCustomer } from '@/lib/customers'
import { getProducts } from '@/lib/products'
import { withProductsMissingFromMaster } from '@/lib/documentMissingProducts'
import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { InvoiceItem, InvoiceFreeItem } from '@/lib/invoices'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import {
    calculateDocumentFormTotals,
} from '@/lib/documentTotals'
import { buildDocumentFreeItems, MATURITY_SERVICE_NAME, CANCELLATION_FEE_NAME, EXECUTION_SURCHARGE_NAME } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import { buildDocumentSubmitPayload } from '@/lib/documentSubmit'
import { buildMergedEstimateItems } from '@/lib/estimateItemMerge'
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
            const storeFilteredProducts = allProducts.map((product) => ({
                ...product,
                variants: product.variants.filter(
                    (v) => !v.storeId || (storeId && String(v.storeId) === storeId)
                ),
            }))
            // プラン別商品設定（非表示商品の除外・セット可否の上書き・初期セット種類の差し替え）を反映する。
            // これを通さないと、プランでセット扱いにした商品がこの画面でだけ満額で計上され、
            // 請求書PDF（プラン適用済み）や元になった見積と金額が食い違う。
            const planSettings = await getProductPlanSettings(
                String((invoiceData as any).planId || BASE_PLAN_ID)
            )
            const planAppliedProducts = applyPlanOverrides(storeFilteredProducts, planSettings)
            // 商品マスタから消えた商品（無効化された商品など）の明細を落とさないよう、
            // 保存済み明細が参照している商品を補ってからマージする。
            // プラン適用より後に補うことで、補った商品がプランの非表示設定で消えるのを防ぐ
            const filteredProducts = withProductsMissingFromMaster(planAppliedProducts, existingItems)

            // 全アクティブ品目と既存請求明細をマージする。組み立ては見積と共通の処理を使う。
            // 以前は見積の処理を写した別物で、保存済み明細の無い商品の初期種類だけ「種類の先頭」になっており、
            // プラン別設定の初期セット品（先頭以外の種類）が請求書でだけ効かず、見積と金額が食い違っていた
            const isMember = !!(invoiceData as any).isMember
            const mergedItems = buildMergedEstimateItems(
                filteredProducts as any,
                existingItems as any,
                isMember,
                false
            ) as unknown as InvoiceItem[]

            const loadedFreeItems: InvoiceFreeItem[] = (invoiceData as any).freeItems || []

            // 固定行は満期サービス・施行割増券・解約手数料の3つ。以前は施行割増券が漏れていて、
            // 請求書では施行割増券を入力できなかった
            const paddedFreeItems = buildDocumentFreeItems(loadedFreeItems, mergedItems, FIXED_ROW_NAMES)
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
                    unitPriceMember: item.unitPriceMember ?? 0,
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
            const payload = buildDocumentSubmitPayload({
                items,
                freeItems,
                formItems: formValues.items,
                formFreeItems: formValues.freeItems,
                isMember,
                customer,
            })
            if (payload.hasNoItems) {
                toast({
                    title: '数量が1以上の品目を少なくとも1つ入力してください',
                    variant: 'destructive',
                    duration: 3000,
                })
                return
            }
            const data = { ...formValues, ...payload.totals, items: payload.items, freeItems: payload.freeItems }
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
// 合計計算ユーティリティ
// -------------------------------------------------------
export const calculateInvoiceTotals = calculateDocumentFormTotals
