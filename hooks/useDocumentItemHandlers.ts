import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UseFormSetValue } from 'react-hook-form'
import { ProductVariant } from '@/lib/products'
import { allowedServiceFlags, resolveUnitPriceMember, resolveVariantChange } from '@/lib/itemPricing'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'

/**
 * 見積・請求書の明細で、種類の選択（通常・複数行構成・複数選択・重箱）と会員区分の切り替えを
 * 明細（items）に反映する処理。見積画面と請求書画面で全く同じ処理だったため、ここにまとめた。
 * 片方だけ直して食い違う不具合を防ぐため、画面側に写しを作らないこと。
 *
 * 数量はここでは扱わない。数量はフォームの値だけが正で、チェック表示・合計・保存もフォームの数量を見る。
 * （以前は重箱の種類選択で items 側の数量も書き換えており、それをきっかけにほかの商品のチェックが外れていた）
 */
export function useDocumentItemHandlers({
    setItems,
    setValue,
    watchedIsMember,
}: {
    setItems: Dispatch<SetStateAction<any[]>>
    setValue: UseFormSetValue<DocumentFormData>
    watchedIsMember: string | undefined
}) {
    const handleVariantChange = (
        index: number,
        variant: ProductVariant | null,
        options?: {
            isService?: boolean
            isMaturityService?: boolean
            adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
            rowVariant?: any
            /** 親祭壇の増額。未選択のときは null */
            surcharge?: { id: string; amount: number } | null
        }
    ) => {
        const isMember = watchedIsMember === 'true'
        const isService = options?.isService ?? false
        const isMaturityService = options?.isMaturityService ?? false
        const adhocSetScope = options?.adhocSetScope ?? 'NONE'
        const surchargeAmount = options?.surcharge?.amount ?? null
        const planSurchargeId = options?.surcharge?.id ?? null
        // setItems の updater 内では setValue（別コンポーネントの状態更新）を直接呼ばない。
        // updater は React 内部で複数回呼ばれ得るため、副作用はここに一旦控えて updater の外で発火する。
        let overwrittenDescription: string | undefined
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                if (options?.rowVariant && (item as any).productRowId) {
                    const rv = options.rowVariant
                    return {
                        ...item,
                        productRowVariantId: String(rv.id),
                        productRowVariant: rv,
                        unitPriceGeneral: rv.unitPrice,
                        unitPriceMember: rv.unitPrice,
                        ...allowedServiceFlags((item as any).productItem, { isService, isMaturityService }),
                        adhocSetScope,
                        // 種類や選択内容が変わると 0 円扱いかどうかも変わる。保存時の控えを外して判定し直させる
                        noChargeScope: null,
                        noChargeReason: null,
                    } as any
                }
                if (!variant) return item
                const product = (item as any).productItem
                let description = item.description
                if (product?.overwriteDescriptionOnVariantChange) {
                    description = variant.name
                    overwrittenDescription = description
                }
                return {
                    ...item,
                    description,
                    productVariantId: variant.id,
                    productVariant: variant,
                    // 増額は一般価格・会員価格の両方に同額を上乗せする。
                    // サービス品・満期サービスの印は、商品マスタで許可された商品でだけ効かせる
                    ...resolveVariantChange(item as any, variant, isMember, {
                        isService,
                        isMaturityService,
                        surchargeAmount,
                    }),
                    surchargeAmount,
                    planSurchargeId,
                    adhocSetScope,
                    // 種類や選択内容が変わると 0 円扱いかどうかも変わる。保存時の控えを外して判定し直させる
                    noChargeScope: null,
                    noChargeReason: null,
                } as any
            })
        )
        if (overwrittenDescription !== undefined) {
            setValue(`items.${index}.description`, overwrittenDescription)
        }
    }

    const handleMultiSelectChange = (
        index: number,
        selectedIds: string[],
        options?: { adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; isService?: boolean; isMaturityService?: boolean }
    ) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                const variants = (item as any).productItem?.variants || []
                const selected = variants.filter((v: any) => selectedIds.includes(String(v.id)))
                const totalGeneral = selected.reduce((s: number, v: any) => s + v.priceGeneral, 0)
                const totalMember = selected.reduce((s: number, v: any) => s + v.priceMember, 0)
                const firstVariant = selected[0] || null
                return {
                    ...item,
                    multiSelectVariantIds: JSON.stringify(selectedIds),
                    productVariantId: firstVariant ? String(firstVariant.id) : undefined,
                    productVariant: firstVariant,
                    unitPriceGeneral: totalGeneral,
                    unitPriceMember: totalMember,
                    adhocSetScope: options?.adhocSetScope ?? 'NONE',
                    ...allowedServiceFlags((item as any).productItem, {
                        isService: options?.isService,
                        isMaturityService: options?.isMaturityService,
                    }),
                    // 種類や選択内容が変わると 0 円扱いかどうかも変わる。保存時の控えを外して判定し直させる
                    noChargeScope: null,
                    noChargeReason: null,
                } as any
            })
        )
    }

    /** グループ商品（重箱など）: 1グループ分の選択結果を更新し、全グループの合計金額を再集計する */
    const handleGroupVariantChange = (index: number, groupId: string, selectedIds: string[]) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                const pi = (item as any).productItem
                const currentSelections: Record<string, string[]> = (item as any).groupSelections
                    ? JSON.parse((item as any).groupSelections)
                    : {}
                const nextSelections = { ...currentSelections, [groupId]: selectedIds }
                const allSelectedVariants: any[] = []
                for (const group of pi?.variantGroups || []) {
                    const ids = nextSelections[String(group.id)] || []
                    allSelectedVariants.push(
                        ...(group.variants || []).filter((v: any) => ids.includes(String(v.id)))
                    )
                }
                return {
                    ...item,
                    groupSelections: JSON.stringify(nextSelections),
                    unitPriceGeneral: allSelectedVariants.reduce((s, v) => s + v.priceGeneral, 0),
                    unitPriceMember: allSelectedVariants.reduce((s, v) => s + v.priceMember, 0),
                    // 種類や選択内容が変わると 0 円扱いかどうかも変わる。保存時の控えを外して判定し直させる
                    noChargeScope: null,
                    noChargeReason: null,
                } as any
            })
        )
    }

    // 会員区分の再計算は、担当者が画面で区分を切り替えたときだけ走らせる。
    // この再計算は会員単価を商品マスタの現在価格で作り直すため、読み込み直後にも走らせると
    // 保存済みの会員単価が上書きされ、価格改定後に旧書類を開くだけで金額が変わってしまう。
    // このコンポーネントは読み込み完了後（reset 済み）にしかマウントされないので、
    // 初回レンダー時の値を「読み込まれた区分」として控え、そこから変化したときだけ再計算する。
    const loadedIsMemberRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        const previousIsMember = loadedIsMemberRef.current
        loadedIsMemberRef.current = watchedIsMember
        if (previousIsMember === undefined || previousIsMember === watchedIsMember) return
        const isMember = watchedIsMember === 'true'
        setItems((prev) =>
            prev.map((item) => {
                // マルチ選択商品: 選択中の全バリアントの会員価格を再集計
                if ((item as any).multiSelectVariantIds) {
                    try {
                        const ids: string[] = JSON.parse((item as any).multiSelectVariantIds)
                        const variants = ((item as any).productItem?.variants || [])
                            .filter((v: any) => ids.includes(String(v.id)))
                        const totalMember = variants.reduce((s: number, v: any) => s + v.priceMember, 0)
                        return { ...item, unitPriceMember: totalMember }
                    } catch { return item }
                }
                // グループ商品（重箱など）: 全グループの選択中バリアントの会員価格を再集計
                if ((item as any).groupSelections) {
                    try {
                        const selections: Record<string, string[]> = JSON.parse((item as any).groupSelections)
                        const groups = (item as any).productItem?.variantGroups || []
                        let totalMember = 0
                        for (const group of groups) {
                            const ids = selections[String(group.id)] || []
                            totalMember += (group.variants || [])
                                .filter((v: any) => ids.includes(String(v.id)))
                                .reduce((s: number, v: any) => s + v.priceMember, 0)
                        }
                        return { ...item, unitPriceMember: totalMember }
                    } catch { return item }
                }
                if (!item.productVariant) return item
                const next = resolveUnitPriceMember(item, item.productVariant, isMember)
                return next === item.unitPriceMember ? item : { ...item, unitPriceMember: next }
            })
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedIsMember])

    return { handleVariantChange, handleMultiSelectChange, handleGroupVariantChange }
}
