'use client'

import { Fragment, useState } from 'react'
import { createPortal } from 'react-dom'
import { Control, FieldArrayWithId, UseFormSetValue, useWatch } from 'react-hook-form'
import { FormInput } from '@/components/form/FormInput'
import { FormCurrencyInput } from '@/components/form/FormCurrencyInput'
import { FormTextarea } from '@/components/form/FormTextarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Image from 'next/image'
import { ImageOff, X } from 'lucide-react'
import { ProductVariant } from '@/lib/products'
import { resolveProductImageUrl } from '@/lib/utils'
import { scopeApplies } from '@/lib/productScope'
import { computeMultiRowAmount } from '@/lib/expandMultiRow'

/**
 * EstimateFormData と InvoiceFormData は構造が完全に一致するため、
 * 共通の DocumentFormData 型として表現できる。
 * TypeScript の structural typing により、どちらの Control も代入可能。
 */
export type DocumentFormData = {
    docNo: string
    status: string
    isMember: string
    cremationProcessType: string
    altarPlaceType: string
    altarPlaceOther: string
    ceilingHeight: string
    estimateStaff: string
    ceremonyStaff: string
    transportStaff: string
    decorationStaff: string
    returnStaff: string
    items: { qty: number; description: string }[]
    freeItems: { parentProductItemId?: string | null; productItemName: string; description: string; unitPriceGeneral: number; qty: number }[]
}

type DocumentRowVariant = {
    id: string
    label: string
    imageUrl?: string | null
    unitPrice: number
    isDefault?: boolean
}

type DocumentRow = {
    id: string
    label: string
    calcType: 'FIXED' | 'UNIT_PRICE_X_QTY'
    defaultQty?: number
    hasReturn?: boolean
    variants: DocumentRowVariant[]
}

type DocumentItem = {
    productItemId?: string | null
    productItem?: {
        name?: string | null
        variants?: ProductVariant[]
        isSetParent?: boolean
        isSetChild?: boolean
        serviceableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        setableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        isMaturityServiceable?: boolean
        isMultiRow?: boolean
        canAddFreeRow?: boolean
        isMultiSelect?: boolean
        multiSelectMerge?: boolean
        rows?: DocumentRow[]
        children?: { id: string; name: string }[]
    } | null
    productVariantId?: string | null
    productVariant?: {
        id: string
        name: string
        isDefaultSet?: boolean
        setPrice?: number
        storeId?: string | null
    } | null
    productRowId?: string | null
    productRowVariantId?: string | null
    calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null
    sign?: number
    productRow?: DocumentRow | null
    productRowVariant?: DocumentRowVariant | null
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    isService?: boolean
    isMaturityService?: boolean
    multiSelectVariantIds?: string | null
}

type DocumentFreeItem = {
    productItemName?: string | null
    unitPriceGeneral: number
    qty: number
}

type Props = {
    items: DocumentItem[]
    fields: FieldArrayWithId<DocumentFormData, 'items', 'id'>[]
    control: Control<DocumentFormData>
    isMember: boolean
    freeItems?: DocumentFreeItem[]
    freeFields?: FieldArrayWithId<DocumentFormData, 'freeItems', 'id'>[]
    handleRemoveFreeItem?: (index: number) => void
    onVariantChange?: (
        index: number,
        variant: ProductVariant,
        options?: {
            isService?: boolean
            isMaturityService?: boolean
            rowVariant?: DocumentRowVariant
        }
    ) => void
    setValue?: UseFormSetValue<DocumentFormData>
    readOnly?: boolean
    /** 顧客の現在の担当店舗 ID。保存済み variant の店舗と異なる場合に警告表示 */
    currentStoreId?: string | null
    onMultiSelectChange?: (
        index: number,
        variantIds: string[],
        options?: { adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; isService?: boolean; isMaturityService?: boolean }
    ) => void
}

export function DocumentItemTable({
    items,
    fields,
    control,
    isMember,
    freeItems = [],
    freeFields = [],
    handleRemoveFreeItem,
    onVariantChange,
    setValue,
    readOnly = false,
    currentStoreId,
    onMultiSelectChange,
}: Props) {
    /** 保存済み variant の店舗が現在の顧客店舗と一致しないか判定 */
    const isStoreMismatch = (item: DocumentItem | undefined): boolean => {
        const variantStoreId = item?.productVariant?.storeId
        if (!variantStoreId) return false // 全店舗共通 variant は OK
        return String(variantStoreId) !== String(currentStoreId ?? '')
    }
    const [variantDialogIndex, setVariantDialogIndex] = useState<number | null>(null)
    const [pendingVariant, setPendingVariant] = useState<ProductVariant | null>(null)
    const [pendingRowVariant, setPendingRowVariant] = useState<DocumentRowVariant | null>(null)
    // 複数行構成商品で「商品単位」ダイアログ用: rowId -> 選択中の variant
    const [pendingRowVariantsMap, setPendingRowVariantsMap] = useState<
        Record<string, DocumentRowVariant>
    >({})
    const [pendingIsService, setPendingIsService] = useState(false)
    const [pendingIsMaturityService, setPendingIsMaturityService] = useState(false)
    const [pendingAdhocSetScope, setPendingAdhocSetScope] = useState<
        'NONE' | 'MEMBER_ONLY' | 'BOTH'
    >('NONE')
    const [pendingMultiVariantIds, setPendingMultiVariantIds] = useState<string[]>([])
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
    const [checkedItems, setCheckedItems] = useState<boolean[]>([])
    const [prevQtySignature, setPrevQtySignature] = useState('')
    const [freeCheckedItems, setFreeCheckedItems] = useState<boolean[]>([])
    const [prevFreeSignature, setPrevFreeSignature] = useState('')

    const qtySignature = items.map((i) => i.qty ?? 0).join(',')
    if (qtySignature !== prevQtySignature) {
        setPrevQtySignature(qtySignature)
        setCheckedItems(items.map((item) => (item.qty ?? 0) > 0))
    }

    const freeSignature = freeItems
        .map((i) => `${(i?.productItemName ?? '').trim()}|${i?.qty ?? 0}`)
        .join(',')
    if (freeSignature !== prevFreeSignature) {
        setPrevFreeSignature(freeSignature)
        setFreeCheckedItems(
            freeItems.map((it) => {
                const name = (it?.productItemName ?? '').trim()
                const qty = it?.qty ?? 0
                const isFixedRow = name === '満期サービス' || name === '解約手数料'
                // 固定行（満期サービス・解約手数料）は qty>0 のときのみチェック扱い。
                // 通常フリー行は qty>0 または品目名入力済みなら有効扱い。
                if (isFixedRow) return qty > 0
                return qty > 0 || name !== ''
            })
        )
    }

    const openVariantDialog = (index: number) => {
        const item = items[index]
        const isMulti = !!item?.productRowId
        if (isMulti && item?.productItemId) {
            // 複数行構成商品: 商品単位モード（同じ productItem の全行の variants を初期化）
            const productItemId = String(item.productItemId)
            const initialMap: Record<string, DocumentRowVariant> = {}
            items.forEach((it) => {
                if (String(it.productItemId) === productItemId && it.productRowId && it.productItem?.rows) {
                    const row = it.productItem.rows.find(
                        (r) => String(r.id) === String(it.productRowId)
                    )
                    if (!row) return
                    const current =
                        row.variants.find(
                            (v) => String(v.id) === String(it.productRowVariantId)
                        ) ||
                        row.variants.find((v) => v.isDefault) ||
                        row.variants[0]
                    if (current) initialMap[String(row.id)] = current
                }
            })
            setPendingRowVariantsMap(initialMap)
            setPendingRowVariant(null)
            setPendingVariant(null)
        } else {
            const isMultiSelectProduct = !!item?.productItem?.isMultiSelect
            if (isMultiSelectProduct) {
                try {
                    // multiSelectVariantIds があればそこから、なければ productVariantId から初期化
                    const ids: string[] = item?.multiSelectVariantIds
                        ? JSON.parse(item.multiSelectVariantIds)
                        : item?.productVariantId
                          ? [String(item.productVariantId)]
                          : []
                    setPendingMultiVariantIds(ids)
                } catch { setPendingMultiVariantIds([]) }
                setPendingVariant(null)
            } else {
                const variants = item?.productItem?.variants || []
                const current =
                    variants.find((v) => v.id === item?.productVariantId) || variants[0] || null
                setPendingVariant(current)
                setPendingMultiVariantIds([])
            }
            setPendingRowVariant(null)
            setPendingRowVariantsMap({})
        }
        setPendingIsService(!!item?.isService)
        setPendingIsMaturityService(!!item?.isMaturityService)
        const adhoc = (item as any)?.adhocSetScope
        setPendingAdhocSetScope(
            adhoc === 'MEMBER_ONLY' || adhoc === 'BOTH' ? adhoc : 'NONE'
        )
        setVariantDialogIndex(index)
    }

    const confirmVariant = () => {
        if (variantDialogIndex !== null) {
            const item = items[variantDialogIndex]
            const isMulti = !!item?.productRowId
            if (isMulti && item?.productItemId) {
                // 商品単位モード: 同じ productItem の全行に対して、選択された rowVariant を反映
                const productItemId = String(item.productItemId)
                items.forEach((it, idx) => {
                    if (
                        String(it.productItemId) === productItemId &&
                        it.productRowId
                    ) {
                        const rv = pendingRowVariantsMap[String(it.productRowId)]
                        if (!rv) return
                        onVariantChange?.(idx, null as unknown as ProductVariant, {
                            isService: pendingIsService,
                            isMaturityService: pendingIsMaturityService,
                            rowVariant: rv,
                        })
                        // 加算行のみ qty=0 を defaultQty に上げる（返品行は0のまま）
                        const isReturnRow = Number(it.sign ?? 1) === -1
                        if (!isReturnRow && !(it.qty && it.qty > 0)) {
                            const row = it.productItem?.rows?.find(
                                (r) => String(r.id) === String(it.productRowId)
                            )
                            const initQty = row?.defaultQty ?? 1
                            setValue?.(
                                `items.${idx}.qty` as `items.${number}.qty`,
                                initQty,
                                { shouldDirty: true }
                            )
                        }
                    }
                })
            } else if (item?.productItem?.isMultiSelect) {
                onMultiSelectChange?.(variantDialogIndex, pendingMultiVariantIds, {
                    adhocSetScope: pendingAdhocSetScope,
                    isService: pendingIsService,
                    isMaturityService: pendingIsMaturityService,
                })
            } else if (pendingVariant) {
                onVariantChange?.(variantDialogIndex, pendingVariant, {
                    isService: pendingIsService,
                    isMaturityService: pendingIsMaturityService,
                    adhocSetScope: pendingAdhocSetScope,
                } as any)
                setValue?.(
                    `items.${variantDialogIndex}.qty` as `items.${number}.qty`,
                    item?.qty || 1,
                    { shouldDirty: true }
                )
            }
            setValue?.('_changeMarker' as any, String(Date.now()), { shouldDirty: true })
        }
        setVariantDialogIndex(null)
        setPendingVariant(null)
        setPendingRowVariant(null)
        setPendingRowVariantsMap({})
        setPendingMultiVariantIds([])
        setPendingIsService(false)
        setPendingAdhocSetScope('NONE')
    }

    const watchedItems = useWatch({ control, name: 'items' })
    const watchedFreeItems = useWatch({ control, name: 'freeItems' })
    const hasRows = fields.length > 0 || freeFields.length > 0

    // 親排他ロジック: どの親祭壇が選ばれているかを判定
    // 「親祭壇かつ qty>0」の最初の項目を選択中とする
    const selectedParentIndex = items.findIndex(
        (it, i) => it?.productItem?.isSetParent && (watchedItems?.[i]?.qty ?? it?.qty ?? 0) > 0
    )
    const selectedParentId = selectedParentIndex >= 0 ? String(items[selectedParentIndex]?.productItemId) : null
    const selectedParentChildIds = new Set<string>(
        selectedParentIndex >= 0
            ? (items[selectedParentIndex]?.productItem?.children || []).map((c) => String(c.id))
            : []
    )

    // 複数行構成商品グループ: 連続する同 productItemId の行を1まとまりとして扱う
    // 各 index に対して、グループ先頭の index を記録（先頭なら自分自身）
    const groupStartIndexOf = (idx: number): number => {
        const item = items[idx]
        if (!item?.productRowId) return idx // 通常商品は単独グループ
        const pid = String(item.productItemId)
        let start = idx
        while (start > 0) {
            const prev = items[start - 1]
            if (!prev?.productRowId || String(prev.productItemId) !== pid) break
            start--
        }
        return start
    }
    const groupSizeOf = (startIdx: number): number => {
        const item = items[startIdx]
        if (!item?.productRowId) return 1
        const pid = String(item.productItemId)
        let count = 0
        for (let i = startIdx; i < items.length; i++) {
            const it = items[i]
            if (!it?.productRowId || String(it.productItemId) !== pid) break
            count++
        }
        return count
    }

    // 行の表示判定（一般・会員共通）
    // 親祭壇は排他（1つだけ選択可）、子セット品は選択中親祭壇に紐づくものだけ表示
    const isRowVisible = (item: DocumentItem | undefined): boolean => {
        if (!item) return true
        const pi = item.productItem
        if (!pi) return true
        // 親祭壇: 別の親が選択されているなら非表示
        if (pi.isSetParent) {
            if (selectedParentId && String(item.productItemId) !== selectedParentId) return false
            return true
        }
        // 子セット品: 選択中親祭壇に紐づくもののみ表示
        if (pi.isSetChild) {
            return selectedParentChildIds.has(String(item.productItemId))
        }
        // 一般商品: 常に表示
        return true
    }
    return (
        <div className="mb-8">
            <h3 className="mb-4">明細</h3>
            <table className="w-full border-collapse bg-white">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="w-16 border border-gray-300 p-1 text-center">有無</th>
                        <th className="w-64 border border-gray-300 p-3 text-center">品目</th>
                        <th className="w-16 border border-gray-300 p-3 text-center">操作</th>
                        <th className="w-36 border border-gray-300 p-3 text-center">数量</th>
                        <th className="w-56 border border-gray-300 p-3 text-center">種類</th>
                        <th className="border border-gray-300 p-3 text-center">摘要</th>
                    </tr>
                </thead>
                <tbody>
                    {!hasRows ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">
                                明細がありません
                            </td>
                        </tr>
                    ) : (
                        <>
                            {fields.map((field, index) => {
                                const item = items[index]
                                if (!isRowVisible(item)) {
                                    // 非表示行は qty を 0 にして登録対象から除外
                                    // setValue はレンダリング中に呼べないため setTimeout で非同期化
                                    if ((watchedItems?.[index]?.qty ?? 0) > 0) {
                                        setTimeout(() => {
                                            setValue?.(
                                                `items.${index}.qty` as `items.${number}.qty`,
                                                0,
                                                { shouldDirty: true }
                                            )
                                        }, 0)
                                    }
                                    return null
                                }
                                const isParent = item?.productItem?.isSetParent
                                const isChild = item?.productItem?.isSetChild
                                // 任意セット扱い (adhocSetScope) が現在モードに該当
                                const adhocScope = (item as any)?.adhocSetScope
                                const isAdhocSetIncluded =
                                    adhocScope === 'BOTH' ||
                                    (adhocScope === 'MEMBER_ONLY' && isMember) ||
                                    (adhocScope === 'GENERAL_ONLY' && !isMember)
                                // 子商品 + 初期セット種類 + setableScope が現在モードに適用: セット扱い
                                const isSetIncluded =
                                    !!(
                                        isChild &&
                                        item?.productVariant?.isDefaultSet &&
                                        scopeApplies(item?.productItem?.setableScope, isMember)
                                    ) || isAdhocSetIncluded
                                // サービス品フラグON + serviceableScope が現在モードに適用: サービス扱い
                                const isServiceIncluded = !!(
                                    item?.isService &&
                                    scopeApplies(item?.productItem?.serviceableScope, isMember)
                                )
                                // 満期サービスフラグON + 商品の満期サービス可否が「可」: 満期サービス扱い
                                const isMaturityServiceIncluded = !!(
                                    item?.isMaturityService && item?.productItem?.isMaturityServiceable
                                )
                                const isExcluded = isSetIncluded || isServiceIncluded || isMaturityServiceIncluded
                                // 選択中の親祭壇に紐づく子セット行は qty=0 でも種類選択を許可（一般/会員共通）
                                const isLinkedChildOfSelectedParent =
                                    !!isChild &&
                                    selectedParentChildIds.has(String(item?.productItemId))
                                const canSelectVariant =
                                    checkedItems[index] || isLinkedChildOfSelectedParent
                                const unitPrice =
                                    item != null ? (isMember ? item.unitPriceMember : item.unitPriceGeneral) : 0
                                const liveQty = watchedItems?.[index]?.qty ?? item?.qty ?? 0
                                // 複数行構成商品: calcType と sign を考慮
                                const isMultiRowItem = !!(item?.productRowId && item?.calcType)
                                const amount = isExcluded
                                    ? 0
                                    : isMultiRowItem
                                      ? computeMultiRowAmount({
                                            calcType: item?.calcType,
                                            sign: item?.sign,
                                            unitPrice,
                                            qty: liveQty,
                                        })
                                      : unitPrice * liveQty
                                // 複数行構成商品グループの先頭か判定
                                const groupStart = groupStartIndexOf(index)
                                const isGroupStart = groupStart === index
                                const groupSize = isGroupStart ? groupSizeOf(index) : 0
                                // グループ内で1つでもチェックされているか（商品単位の表示状態）
                                const groupAnyChecked = (() => {
                                    if (!isMultiRowItem) return checkedItems[index] ?? false
                                    const start = groupStart
                                    const size = groupSizeOf(start)
                                    for (let i = start; i < start + size; i++) {
                                        if (checkedItems[i]) return true
                                    }
                                    return false
                                })()
                                // 親付きフリー行の index を取得（商品マスタの canAddFreeRow=ON で見積/請求書に含まれる商品）
                                const itemPid = String(item?.productItemId ?? '')
                                const linkedFreeIndex =
                                    item?.productItem?.canAddFreeRow &&
                                    (watchedItems?.[index]?.qty ?? 0) > 0
                                        ? (watchedFreeItems ?? []).findIndex(
                                              (fi: any) =>
                                                  fi?.parentProductItemId &&
                                                  String(fi.parentProductItemId) === itemPid
                                          )
                                        : -1

                                return (
                                    <Fragment key={field.id}>
                                    <tr
                                        style={isChild ? { backgroundColor: '#fcfaf2' } : undefined}
                                    >
                                        {(!isMultiRowItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-1 text-center"
                                                rowSpan={isMultiRowItem ? groupSize : undefined}
                                            >
                                                {!readOnly && (
                                                    <input
                                                        type="checkbox"
                                                        checked={isMultiRowItem ? groupAnyChecked : (checkedItems[index] ?? false)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked
                                                            const currentItem = items[index]
                                                            const isSetParent = !!currentItem?.productItem?.isSetParent

                                                            // 親祭壇なら、紐づく子商品 index を計算（自動チェック・一般/会員共通）
                                                            let childIndexes: number[] = []
                                                            if (isSetParent) {
                                                                const childIds = new Set<string>(
                                                                    (currentItem!.productItem!.children || []).map((c) =>
                                                                        String(c.id)
                                                                    )
                                                                )
                                                                items.forEach((it, i) => {
                                                                    if (
                                                                        it?.productItem?.isSetChild &&
                                                                        childIds.has(String(it.productItemId))
                                                                    ) {
                                                                        childIndexes.push(i)
                                                                    }
                                                                })
                                                            }

                                                            // 複数行構成商品: 同グループの全行 index を取得
                                                            const groupIndexes: number[] = isMultiRowItem
                                                                ? Array.from({ length: groupSize }, (_, k) => groupStart + k)
                                                                : [index]

                                                            // checkedItems を一括更新
                                                            setCheckedItems((prev) => {
                                                                const next = [...prev]
                                                                for (const gi of groupIndexes) {
                                                                    next[gi] = checked
                                                                }
                                                                for (const ci of childIndexes) {
                                                                    next[ci] = checked
                                                                }
                                                                return next
                                                            })

                                                            // qty を一括更新（フォームを dirty 化）
                                                            for (const gi of groupIndexes) {
                                                                const gItem = items[gi]
                                                                const defaultQty = gItem?.productRow?.defaultQty ?? 1
                                                                setValue?.(
                                                                    `items.${gi}.qty` as `items.${number}.qty`,
                                                                    checked ? defaultQty : 0,
                                                                    { shouldDirty: true }
                                                                )
                                                            }
                                                            for (const ci of childIndexes) {
                                                                setValue?.(
                                                                    `items.${ci}.qty` as `items.${number}.qty`,
                                                                    checked ? 1 : 0,
                                                                    { shouldDirty: true }
                                                                )
                                                            }
                                                        }}
                                                        className="h-5 w-5 cursor-pointer"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        {(!isMultiRowItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-3"
                                                rowSpan={isMultiRowItem ? groupSize : undefined}
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {isChild && (
                                                        <span
                                                            className="font-mincho"
                                                            style={{
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                backgroundColor: 'var(--brand-gold)',
                                                                color: 'var(--brand-navy-dark)',
                                                                letterSpacing: '0.1em',
                                                            }}
                                                        >
                                                            セット
                                                        </span>
                                                    )}
                                                    {isParent && (
                                                        <span
                                                            className="font-mincho"
                                                            style={{
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                backgroundColor: 'var(--brand-navy)',
                                                                color: '#ffffff',
                                                                letterSpacing: '0.1em',
                                                            }}
                                                        >
                                                            親祭壇
                                                        </span>
                                                    )}
                                                    <span>{item?.productItem?.name ?? '-'}</span>
                                                    {isStoreMismatch(item) && (liveQty ?? 0) > 0 && (
                                                        <span
                                                            className="font-mincho"
                                                            title="保存済みの種類が現在の顧客の担当店舗で利用できません。種類を選び直してください。"
                                                            style={{
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                backgroundColor: 'var(--brand-red)',
                                                                color: '#ffffff',
                                                                letterSpacing: '0.1em',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            ⚠ 店舗変更により利用不可
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {(!isMultiRowItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-3 text-center"
                                                rowSpan={isMultiRowItem ? groupSize : undefined}
                                            >
                                                {!readOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openVariantDialog(index)}
                                                        disabled={!canSelectVariant}
                                                        className="cursor-pointer rounded border-0 bg-transparent p-1 text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                                                        title="種類選択"
                                                    >
                                                        <span
                                                            className="material-symbols-outlined"
                                                            style={{ fontSize: '2rem' }}
                                                        >
                                                            feature_search
                                                        </span>
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                        <td className="border border-gray-300 p-3">
                                            <FormInput
                                                name={`items.${index}.qty`}
                                                control={control}
                                                type="number"
                                                min={0}
                                                max={3000}
                                                disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-3 text-right">
                                            {isMultiRowItem ? (
                                                <>
                                                    <div
                                                        className="text-xs"
                                                        style={{
                                                            color:
                                                                (item?.sign ?? 1) === -1
                                                                    ? 'var(--brand-red)'
                                                                    : 'var(--brand-text-muted)',
                                                        }}
                                                    >
                                                        {item?.productRow?.label ?? ''}
                                                        {item?.calcType === 'FIXED' ? '（固定）' : ''}
                                                        {(item?.sign ?? 1) === -1 ? '（返品）' : ''}
                                                    </div>
                                                    <div>
                                                        {(item?.sign ?? 1) === -1 ? '- ' : ''}¥
                                                        {Math.abs(amount).toLocaleString()}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-sm">
                                                        {(item?.productItem?.isMultiSelect && item?.multiSelectVariantIds)
                                                            ? (() => {
                                                                try {
                                                                    const ids: string[] = JSON.parse(item.multiSelectVariantIds as string)
                                                                    const names = (item?.productItem?.variants || [])
                                                                        .filter((v: any) => ids.includes(String(v.id)))
                                                                        .map((v: any) => v.name)
                                                                    return names.length > 0 ? `${names.join('、')}（${names.length}種類）` : '-'
                                                                } catch { return '-' }
                                                              })()
                                                            : item?.productVariant?.name ?? '-'}
                                                    </div>
                                                    {isMaturityServiceIncluded ? (
                                                        <div
                                                            style={{
                                                                color: 'var(--brand-gold-soft)',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            満期サービス
                                                        </div>
                                                    ) : isServiceIncluded ? (
                                                        <div
                                                            style={{
                                                                color: 'var(--brand-gold-soft)',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            サービス
                                                        </div>
                                                    ) : isSetIncluded ? (
                                                        <div
                                                            style={{
                                                                color: 'var(--brand-gold-soft)',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            セット
                                                        </div>
                                                    ) : (
                                                        <div>¥{amount.toLocaleString()}</div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td className="border border-gray-300 p-3">
                                            <FormTextarea
                                                name={`items.${index}.description`}
                                                control={control}
                                                rows={2}
                                                noResize
                                                maxRows={2}
                                                disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                            />
                                        </td>
                                    </tr>
                                    {linkedFreeIndex >= 0 && (
                                        <tr
                                            key={`free-of-${itemPid}`}
                                            style={{ backgroundColor: '#f7f5ee' }}
                                        >
                                            <td className="border border-gray-300 p-1 text-center text-xs text-gray-500">
                                                ↳
                                            </td>
                                            <td className="border border-gray-300 p-3">
                                                <FormInput
                                                    name={`freeItems.${linkedFreeIndex}.productItemName`}
                                                    control={control}
                                                    type="text"
                                                    placeholder="品目名（自由入力）"
                                                    disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                            <td className="border border-gray-300 p-3 text-center text-sm text-gray-500">
                                                追加行
                                            </td>
                                            <td className="border border-gray-300 p-3">
                                                <FormInput
                                                    name={`freeItems.${linkedFreeIndex}.qty`}
                                                    control={control}
                                                    type="number"
                                                    min={0}
                                                    max={3000}
                                                    disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                            <td className="border border-gray-300 p-3 text-right">
                                                <FormCurrencyInput
                                                    name={`freeItems.${linkedFreeIndex}.unitPriceGeneral`}
                                                    control={control}
                                                    disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                            <td className="border border-gray-300 p-3">
                                                <FormTextarea
                                                    name={`freeItems.${linkedFreeIndex}.description`}
                                                    control={control}
                                                    rows={2}
                                                    noResize
                                                    maxRows={2}
                                                    disabled={isMultiRowItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                    </Fragment>
                                )
                            })}
                            {freeFields.map((field, index) => {
                                // 親付きフリー行（商品の直下に既に表示済み）は下部テーブルからは除外
                                if (watchedFreeItems?.[index]?.parentProductItemId) return null
                                const liveQty = watchedFreeItems?.[index]?.qty ?? freeItems[index]?.qty ?? 0
                                const liveUnitPrice =
                                    watchedFreeItems?.[index]?.unitPriceGeneral ??
                                    freeItems[index]?.unitPriceGeneral ??
                                    0
                                const isChecked = freeCheckedItems[index] ?? false
                                const inputsDisabled = readOnly || !isChecked
                                const itemName =
                                    freeItems[index]?.productItemName ??
                                    watchedFreeItems?.[index]?.productItemName ??
                                    ''
                                const isMaturity = itemName === '満期サービス'
                                const isCancellationFee = itemName === '解約手数料'
                                const isFixedRow = isMaturity || isCancellationFee
                                const amount = isChecked
                                    ? isFixedRow
                                        ? liveUnitPrice
                                        : liveUnitPrice * liveQty
                                    : 0
                                const rowBgClass = isMaturity
                                    ? 'bg-amber-50'
                                    : isCancellationFee
                                      ? 'bg-rose-50'
                                      : 'bg-blue-50'
                                return (
                                    <tr key={field.id} className={rowBgClass}>
                                        <td className="border border-gray-300 p-1 text-center">
                                            {!readOnly && (
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked
                                                        setFreeCheckedItems((prev) => {
                                                            const next = [...prev]
                                                            next[index] = checked
                                                            return next
                                                        })
                                                        setValue?.(
                                                            `freeItems.${index}.qty` as `freeItems.${number}.qty`,
                                                            checked ? 1 : 0,
                                                            { shouldDirty: true }
                                                        )
                                                    }}
                                                    className="h-5 w-5 cursor-pointer"
                                                />
                                            )}
                                        </td>
                                        {isFixedRow ? (
                                            <>
                                                <td className="border border-gray-300 p-3">
                                                    <span
                                                        className="font-mincho"
                                                        style={{
                                                            fontSize: '15px',
                                                            color: 'var(--brand-navy)',
                                                            fontWeight: 600,
                                                            letterSpacing: '0.1em',
                                                        }}
                                                    >
                                                        {itemName}
                                                    </span>
                                                </td>
                                                <td className="border border-gray-300 p-3 text-center text-sm text-gray-500">
                                                    固定
                                                </td>
                                                <td className="border border-gray-300 p-3" />
                                                <td className="border border-gray-300 p-3 text-right">
                                                    <FormCurrencyInput
                                                        name={`freeItems.${index}.unitPriceGeneral`}
                                                        control={control}
                                                        disabled={inputsDisabled}
                                                    />
                                                    <div className="text-md mt-1">
                                                        ¥{amount.toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="border border-gray-300 p-3" />
                                            </>
                                        ) : (
                                            <>
                                                <td className="border border-gray-300 p-3">
                                                    <FormInput
                                                        name={`freeItems.${index}.productItemName`}
                                                        control={control}
                                                        type="text"
                                                        placeholder="品目名"
                                                        disabled={inputsDisabled}
                                                    />
                                                </td>
                                                <td className="border border-gray-300 p-3 text-center text-sm text-gray-500">
                                                    自由
                                                </td>
                                                <td className="border border-gray-300 p-3">
                                                    <FormInput
                                                        name={`freeItems.${index}.qty`}
                                                        control={control}
                                                        type="number"
                                                        min={0}
                                                        max={3000}
                                                        disabled={inputsDisabled}
                                                    />
                                                </td>
                                                <td className="border border-gray-300 p-3 text-right">
                                                    <FormCurrencyInput
                                                        name={`freeItems.${index}.unitPriceGeneral`}
                                                        control={control}
                                                        disabled={inputsDisabled}
                                                    />
                                                    <div className="text-md mt-1">
                                                        ¥{amount.toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="border border-gray-300 p-3">
                                                    <FormTextarea
                                                        name={`freeItems.${index}.description`}
                                                        control={control}
                                                        rows={2}
                                                        noResize
                                                        maxRows={2}
                                                        disabled={inputsDisabled}
                                                    />
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                )
                            })}
                        </>
                    )}
                </tbody>
            </table>

            {/* 種類選択ダイアログ */}
            {enlargedImage &&
                createPortal(
                    <div
                        className="fixed inset-0 flex items-center justify-center bg-black/70"
                        style={{ zIndex: 99999, pointerEvents: 'auto' }}
                        onClick={() => setEnlargedImage(null)}
                    >
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setEnlargedImage(null)}
                                className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow"
                                aria-label="閉じる"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <Image
                                src={enlargedImage}
                                alt="拡大画像"
                                width={480}
                                height={480}
                                className="max-h-[80vh] max-w-[80vw] rounded object-contain"
                            />
                        </div>
                    </div>,
                    document.body
                )}
            <Dialog open={variantDialogIndex !== null} onOpenChange={(open) => !open && setVariantDialogIndex(null)}>
                <DialogContent
                    className="flex max-w-xl flex-col"
                    style={{ maxHeight: '90vh' }}
                    onInteractOutside={(e) => {
                        if (enlargedImage) e.preventDefault()
                    }}
                >
                    <DialogHeader className="shrink-0">
                        <DialogTitle>種類選択</DialogTitle>
                    </DialogHeader>
                    {variantDialogIndex !== null &&
                        (() => {
                            const item = items[variantDialogIndex]
                            const variants = item?.productItem?.variants || []
                            const isChildItem = !!item?.productItem?.isSetChild
                            // 複数行構成行か（productRowId あり）
                            const isMultiRowItem = !!item?.productRowId
                            const isMultiSelectProduct = !!item?.productItem?.isMultiSelect
                            // 商品単位モード: 同じ商品の全行を取得し、各行の ProductRow を表示
                            const productRows = isMultiRowItem
                                ? item?.productItem?.rows || []
                                : []
                            // serviceableScope が現在モードに適用される商品のみチェック可能
                            const canBeService = scopeApplies(
                                item?.productItem?.serviceableScope,
                                isMember
                            )
                            // 満期サービス可否が「可」の商品のみチェック可能
                            const canBeMaturityService = !!item?.productItem?.isMaturityServiceable
                            // 子商品の場合はセット価格モードで表示（一般/会員共通、setPrice は会員のみ参照）
                            const showSetPrice = isMember && isChildItem
                            return (
                                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                    <p className="mb-4 text-lg font-medium">{item?.productItem?.name}</p>
                                    {canBeService && (
                                        <label
                                            className="mb-4 flex items-center gap-2 font-mincho cursor-pointer select-none"
                                            style={{
                                                padding: '10px 14px',
                                                border: pendingIsService
                                                    ? '1px solid var(--brand-gold)'
                                                    : '1px solid var(--brand-border)',
                                                backgroundColor: pendingIsService
                                                    ? 'rgba(196, 174, 106, 0.1)'
                                                    : '#ffffff',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={pendingIsService}
                                                onChange={(e) => {
                                                    const next = e.target.checked
                                                    setPendingIsService(next)
                                                    // 排他: サービス品 ON 時は満期サービスとセット扱いを OFF
                                                    if (next) {
                                                        setPendingIsMaturityService(false)
                                                        setPendingAdhocSetScope('NONE')
                                                    }
                                                }}
                                                className="h-5 w-5 cursor-pointer"
                                            />
                                            <span
                                                style={{
                                                    fontSize: '14px',
                                                    color: 'var(--brand-navy)',
                                                    letterSpacing: '0.1em',
                                                }}
                                            >
                                                サービス品とする（会員価格を 0 円扱い、合計から除外）
                                            </span>
                                        </label>
                                    )}
                                    {canBeMaturityService && (
                                        <label
                                            className="mb-4 flex items-center gap-2 font-mincho cursor-pointer select-none"
                                            style={{
                                                padding: '10px 14px',
                                                border: pendingIsMaturityService
                                                    ? '1px solid var(--brand-gold)'
                                                    : '1px solid var(--brand-border)',
                                                backgroundColor: pendingIsMaturityService
                                                    ? 'rgba(196, 174, 106, 0.1)'
                                                    : '#ffffff',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={pendingIsMaturityService}
                                                onChange={(e) => {
                                                    const next = e.target.checked
                                                    setPendingIsMaturityService(next)
                                                    // 排他: 満期サービス ON 時はサービス品とセット扱いを OFF
                                                    if (next) {
                                                        setPendingIsService(false)
                                                        setPendingAdhocSetScope('NONE')
                                                    }
                                                }}
                                                className="h-5 w-5 cursor-pointer"
                                            />
                                            <span
                                                style={{
                                                    fontSize: '14px',
                                                    color: 'var(--brand-navy)',
                                                    letterSpacing: '0.1em',
                                                }}
                                            >
                                                満期サービスとする（会員価格を 0 円扱い、合計から除外）
                                            </span>
                                        </label>
                                    )}
                                    {/* 一般商品 (親セット/子セットでない) のみ：見積単位のセット扱い設定 */}
                                    {!isChildItem && !item?.productItem?.isSetParent && (
                                        <div
                                            className="mb-4 font-mincho"
                                            style={{
                                                padding: '10px 14px',
                                                border: '1px solid var(--brand-border)',
                                                backgroundColor:
                                                    pendingAdhocSetScope !== 'NONE'
                                                        ? 'rgba(196, 174, 106, 0.1)'
                                                        : '#ffffff',
                                            }}
                                        >
                                            <p
                                                className="mb-2"
                                                style={{
                                                    fontSize: '14px',
                                                    color: 'var(--brand-navy)',
                                                    letterSpacing: '0.1em',
                                                }}
                                            >
                                                この商品をセット扱いにする（合計金額から除外）
                                            </p>
                                            <div className="flex flex-col gap-1">
                                                {(
                                                    [
                                                        { value: 'NONE', label: 'しない' },
                                                        { value: 'MEMBER_ONLY', label: '会員価格のみ' },
                                                        { value: 'BOTH', label: '両方の価格' },
                                                    ] as { value: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; label: string }[]
                                                ).map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="adhocSetScope"
                                                            value={opt.value}
                                                            checked={pendingAdhocSetScope === opt.value}
                                                            onChange={() => {
                                                                setPendingAdhocSetScope(opt.value)
                                                                // 排他: セット扱い ON (NONE 以外) 時はサービス品と満期サービスを OFF
                                                                if (opt.value !== 'NONE') {
                                                                    setPendingIsService(false)
                                                                    setPendingIsMaturityService(false)
                                                                }
                                                            }}
                                                            className="h-4 w-4 cursor-pointer"
                                                        />
                                                        <span
                                                            style={{
                                                                fontSize: '13px',
                                                                color: 'var(--brand-text)',
                                                            }}
                                                        >
                                                            {opt.label}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {isMultiRowItem ? (
                                        productRows.length === 0 ? (
                                            <p className="text-gray-500">明細行が登録されていません</p>
                                        ) : (
                                            <div className="flex flex-col gap-5">
                                                {productRows.map((pRow) => {
                                                    return (
                                                        <div key={pRow.id}>
                                                            <p
                                                                className="mb-2 font-mincho"
                                                                style={{
                                                                    fontSize: 13,
                                                                    color: 'var(--brand-text-muted)',
                                                                    letterSpacing: '0.1em',
                                                                }}
                                                            >
                                                                {pRow.label}
                                                                {pRow.calcType === 'FIXED'
                                                                    ? '（固定額）'
                                                                    : '（単価×数量）'}
                                                                {pRow.hasReturn && (
                                                                    <span
                                                                        style={{
                                                                            marginLeft: 8,
                                                                            color: 'var(--brand-red)',
                                                                            fontSize: 11,
                                                                        }}
                                                                    >
                                                                        ＋返品行あり
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {pRow.variants.length === 0 ? (
                                                                <p className="text-gray-500">
                                                                    この行に種類が登録されていません
                                                                </p>
                                                            ) : (
                                                                <div className="grid grid-cols-3 gap-3">
                                                                    {pRow.variants.map((v) => {
                                                                        const selected =
                                                                            pendingRowVariantsMap[
                                                                                String(pRow.id)
                                                                            ]
                                                                        const isSelected =
                                                                            String(selected?.id) ===
                                                                            String(v.id)
                                                                        return (
                                                                            <button
                                                                                key={v.id}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setPendingRowVariantsMap(
                                                                                        (prev) => ({
                                                                                            ...prev,
                                                                                            [String(
                                                                                                pRow.id
                                                                                            )]: v,
                                                                                        })
                                                                                    )
                                                                                }
                                                                                className={`flex flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                                                                                    isSelected
                                                                                        ? 'border-blue-500 bg-blue-100'
                                                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                                                }`}
                                                                            >
                                                                                <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded">
                                                                                    {v.imageUrl ? (
                                                                                        <div
                                                                                            role="button"
                                                                                            tabIndex={-1}
                                                                                            className="h-full w-full cursor-zoom-in"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation()
                                                                                                setEnlargedImage(
                                                                                                    resolveProductImageUrl(
                                                                                                        v.imageUrl
                                                                                                    ) || ''
                                                                                                )
                                                                                            }}
                                                                                            aria-label="画像を拡大"
                                                                                        >
                                                                                            <Image
                                                                                                src={
                                                                                                    resolveProductImageUrl(
                                                                                                        v.imageUrl
                                                                                                    ) || ''
                                                                                                }
                                                                                                alt={v.label}
                                                                                                width={96}
                                                                                                height={96}
                                                                                                className="h-full w-full object-contain"
                                                                                            />
                                                                                        </div>
                                                                                    ) : (
                                                                                        <ImageOff className="h-10 w-10 text-gray-300" />
                                                                                    )}
                                                                                </div>
                                                                                <p className="mb-1 text-center text-base font-medium leading-snug">
                                                                                    {v.label || '(無名)'}
                                                                                </p>
                                                                                <p className="text-sm text-gray-600">
                                                                                    ¥
                                                                                    {v.unitPrice.toLocaleString()}
                                                                                </p>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    ) : variants.length === 0 ? (
                                        <p className="text-gray-500">種類がありません</p>
                                    ) : isMultiSelectProduct ? (
                                        <>
                                            <p className="mb-3 text-sm" style={{ color: 'var(--brand-text-muted)' }}>
                                                複数選択可（タップで選択・解除）
                                            </p>
                                            <div className="grid grid-cols-3 gap-3">
                                                {variants.map((v: any) => {
                                                    const isSelected = pendingMultiVariantIds.includes(String(v.id))
                                                    return (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setPendingMultiVariantIds((prev) =>
                                                                    isSelected
                                                                        ? prev.filter((id) => id !== String(v.id))
                                                                        : [...prev, String(v.id)]
                                                                )
                                                            }
                                                            className={`flex flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                                                                isSelected
                                                                    ? 'border-blue-500 bg-blue-100'
                                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded">
                                                                {v.imageUrl ? (
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={-1}
                                                                        className="h-full w-full cursor-zoom-in"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setEnlargedImage(
                                                                                resolveProductImageUrl(v.imageUrl) || ''
                                                                            )
                                                                        }}
                                                                        aria-label="画像を拡大"
                                                                    >
                                                                        <Image
                                                                            src={resolveProductImageUrl(v.imageUrl) || ''}
                                                                            alt={v.name}
                                                                            width={96}
                                                                            height={96}
                                                                            className="h-full w-full object-contain"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <ImageOff className="h-10 w-10 text-gray-300" />
                                                                )}
                                                            </div>
                                                            <p className="mb-1 w-full text-center text-xl font-medium leading-snug">
                                                                {v.name}
                                                            </p>
                                                            <p className="text-lg text-gray-500">
                                                                一般: ¥{v.priceGeneral.toLocaleString()}
                                                            </p>
                                                            <p className="text-lg text-gray-500">
                                                                会員: ¥{v.priceMember.toLocaleString()}
                                                            </p>
                                                            {isSelected && (
                                                                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--brand-navy)' }}>
                                                                    ✓ 選択中
                                                                </p>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-3">
                                            {variants.map((v: any) => {
                                                const isSelected = pendingVariant?.id === v.id
                                                return (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        onClick={() => setPendingVariant(v)}
                                                        className={`flex flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                                                            isSelected
                                                                ? 'border-blue-500 bg-blue-100'
                                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded">
                                                            {v.imageUrl ? (
                                                                <div
                                                                    role="button"
                                                                    tabIndex={-1}
                                                                    className="h-full w-full cursor-zoom-in"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEnlargedImage(
                                                                            resolveProductImageUrl(v.imageUrl) || ''
                                                                        )
                                                                    }}
                                                                    aria-label="画像を拡大"
                                                                >
                                                                    <Image
                                                                        src={resolveProductImageUrl(v.imageUrl) || ''}
                                                                        alt={v.name}
                                                                        width={96}
                                                                        height={96}
                                                                        className="h-full w-full object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <ImageOff className="h-10 w-10 text-gray-300" />
                                                            )}
                                                        </div>
                                                        <p className="mb-1 w-full text-center text-xl font-medium leading-snug">
                                                            {v.name}
                                                        </p>
                                                        <p className="text-lg text-gray-500">
                                                            一般: ¥{v.priceGeneral.toLocaleString()}
                                                        </p>
                                                        <p className="text-lg text-gray-500">
                                                            会員: ¥{v.priceMember.toLocaleString()}
                                                        </p>
                                                        {showSetPrice && (
                                                            v.isDefaultSet ? (
                                                                <p
                                                                    className="text-lg font-semibold"
                                                                    style={{ color: 'var(--brand-gold-soft)' }}
                                                                >
                                                                    セット
                                                                </p>
                                                            ) : (
                                                                <p className="text-lg text-gray-500">
                                                                    セット: ¥{(v.setPrice ?? 0).toLocaleString()}
                                                                </p>
                                                            )
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    <DialogFooter className="shrink-0">
                        <button
                            type="button"
                            onClick={() => setVariantDialogIndex(null)}
                            className="cursor-pointer rounded border border-gray-300 bg-white px-4 py-2 text-gray-700"
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            onClick={confirmVariant}
                            disabled={
                                !pendingVariant &&
                                !pendingRowVariant &&
                                Object.keys(pendingRowVariantsMap).length === 0 &&
                                pendingMultiVariantIds.length === 0
                            }
                            className="cursor-pointer rounded border-0 bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            確定
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
