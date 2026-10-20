import { useState, useEffect, useCallback } from 'react'
import { UseFormReset } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getEstimate, createEstimate, updateEstimate, Estimate, EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { getCustomer } from '@/lib/customers'
import { getCompanyProfile } from '@/lib/company'
import { getProducts, ProductItem } from '@/lib/products'
import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { withProductsMissingFromMaster } from '@/lib/documentMissingProducts'
import { buildNewEstimateItems, buildMergedEstimateItems } from '@/lib/estimateItemMerge'
import { toast } from '@/hooks/use-toast'
import { handleLoadError, handleSaveError } from '@/lib/errorHandler'
import {
    calculateDocumentFormTotals,
    clearNoChargeSnapshot,
} from '@/lib/documentTotals'
import { buildDocumentFreeItems, MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME } from '@/lib/documentUtils'
import { useDocumentProductSearch } from '@/hooks/useDocumentProductSearch'
import { buildDocumentSubmitPayload } from '@/lib/documentSubmit'
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
            const initialFreeItems = buildDocumentFreeItems<EstimateFreeItem>([], initialItems, [MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME])
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
                    unitPriceMember: item.unitPriceMember ?? 0,
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
            // プランを切り替えるとセット可否と初期セット種類が変わるため、
            // 全行の 0 円扱いの控えを外して新しいプランで判定し直させる
            const snapshot = items.map((item, i) =>
                clearNoChargeSnapshot({
                    ...item,
                    qty: currentFormItems?.[i]?.qty ?? item.qty,
                    description: currentFormItems?.[i]?.description ?? item.description,
                })
            )
            const disappearingNames = findItemsDisappearingOnPlanChange(snapshot, newFilteredProducts)
            if (disappearingNames.length > 0) {
                const ok = confirm(
                    `プランを切り替えると、以下の明細は選択できなくなり削除されます:\n\n・${disappearingNames.join('\n・')}\n\nよろしいですか？`
                )
                if (!ok) return null
            }
            const rebuilt = buildMergedEstimateItems(newFilteredProducts, snapshot, isMember, true)
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
            // 商品マスタから消えた商品（無効化された商品など）の明細を落とさないよう、
            // 保存済み明細が参照している商品を補ってからマージする。
            // プラン切替時もこの補完を効かせたいので、状態に持たせる時点で補っておく。
            const filteredByStore = withProductsMissingFromMaster(
                filterProductsByStore(allProducts, storeId),
                existingItems
            )
            setStoreFilteredProducts(filteredByStore)
            const currentPlanId = estimateData.planId || BASE_PLAN_ID
            setPlanId(currentPlanId)
            const planSettings = await getProductPlanSettings(currentPlanId)
            const filteredProducts = applyPlanOverrides(filteredByStore, planSettings)
            const isMember = !!(estimateData as any).isMember
            const mergedItems = buildMergedEstimateItems(filteredProducts, existingItems, isMember, false)
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
                    unitPriceMember: item.unitPriceMember ?? 0,
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
            // プランを切り替えるとセット可否と初期セット種類が変わるため、
            // 全行の 0 円扱いの控えを外して新しいプランで判定し直させる
            const snapshot = items.map((item, i) =>
                clearNoChargeSnapshot({
                    ...item,
                    qty: currentFormItems?.[i]?.qty ?? item.qty,
                    description: currentFormItems?.[i]?.description ?? item.description,
                })
            )
            const disappearingNames = findItemsDisappearingOnPlanChange(snapshot, newFilteredProducts)
            if (disappearingNames.length > 0) {
                const ok = confirm(
                    `プランを切り替えると、以下の明細は選択できなくなり削除されます:\n\n・${disappearingNames.join('\n・')}\n\nよろしいですか？`
                )
                if (!ok) return null
            }
            const rebuilt = buildMergedEstimateItems(newFilteredProducts, snapshot, isMember, true)
            setItems(rebuilt)
            setPlanId(newPlanId)
            return rebuilt
        },
        [items, storeFilteredProducts]
    )

    const onSubmit = async (formValues: EstimateFormData) => {
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
// 合計計算ユーティリティ
// -------------------------------------------------------
export const calculateTotals = calculateDocumentFormTotals
