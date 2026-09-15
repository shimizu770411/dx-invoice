'use client'

import { Fragment, useRef, useState } from 'react'
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
import { EXECUTION_SURCHARGE_NAME } from '@/lib/documentUtils'
import { PlanSurcharge, canApplySurcharge } from '@/lib/planSurcharges'
import { MISSING_FROM_MASTER_LABEL } from '@/lib/documentMissingProducts'
import { displayProductItemName } from '@/lib/documentDisplayNames'

// props 未指定時のフォールバック。毎レンダー新しい配列を渡すと、
// これに依存する処理が無駄に再計算されるため安定した参照を使う
const EMPTY_SURCHARGES: PlanSurcharge[] = []

// 種類列: 表示文字列（バリアント名連結+「（n種類）」）がこの文字数を超えたら集約表示にする
// 列幅320px（左右padding24pxを除くと296px）で全角文字が折り返さず収まる目安の文字数
const TYPE_COLUMN_COLLAPSE_THRESHOLD = 20

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
    altarType: string
    ceilingHeight: string
    memberCardNote: string
    estimateStaff: string
    ceremonyStaff: string
    transportStaff: string
    decorationStaff: string
    returnStaff: string
    remarks: string
    items: { qty: number; description: string }[]
    freeItems: { parentProductItemId?: string | null; productItemName: string; description: string; unitPriceGeneral: number; qty: number }[]
}

type DocumentRowVariant = {
    id: string
    label: string
    abbreviatedName?: string | null
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

type DocumentVariantGroup = {
    id: string
    label: string
    selectionType: 'SINGLE' | 'MULTI'
    isRequired?: boolean
    variants: ProductVariant[]
}

type DocumentItem = {
    productItemId?: string | null
    /** 保存時点の商品名・種類名。商品マスタで改名されても保存済み書類の文言を保つための控え */
    productItemName?: string | null
    productVariantName?: string | null
    productItem?: {
        /** 商品マスタから消えた商品を保存済み明細から復元した行かどうか */
        isMissingFromMaster?: boolean
        name?: string | null
        variants?: ProductVariant[]
        isSetParent?: boolean
        isSetChild?: boolean
        isPlanForcedSet?: boolean
        serviceableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        setableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        isMaturityServiceable?: boolean
        isMultiRow?: boolean
        canAddFreeRow?: boolean
        isMultiSelect?: boolean
        multiSelectMerge?: boolean
        hasVariantGroups?: boolean
        showProductVariantName?: boolean
        overwriteDescriptionOnVariantChange?: boolean
        variantGroups?: DocumentVariantGroup[]
        rows?: DocumentRow[]
        children?: { id: string; name: string }[]
    } | null
    productVariantId?: string | null
    productVariant?: {
        id: string
        name: string
        abbreviatedName?: string | null
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
    /** グループ商品（重箱など）の選択状態。JSON文字列: { [groupId]: variantId[] } */
    groupSelections?: string | null
    /** 保存後の行がどのバリアントグループ（重箱の基本セット／追加オプション等）由来かを示す */
    productVariantGroupId?: string | null
    /** 親祭壇の増額。各単価には既に上乗せ済みのため、表示と再選択のためだけに持つ */
    surchargeAmount?: number | null
    planSurchargeId?: string | null
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
            surcharge?: { id: string; amount: number } | null
        }
    ) => void
    setValue?: UseFormSetValue<DocumentFormData>
    readOnly?: boolean
    /** 顧客の現在の担当店舗 ID。保存済み variant の店舗と異なる場合に警告表示 */
    currentStoreId?: string | null
    /** 選択中プランの親祭壇の増額選択肢。空のプランでは増額の選択自体を出さない */
    planSurcharges?: PlanSurcharge[]
    onMultiSelectChange?: (
        index: number,
        variantIds: string[],
        options?: { adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; isService?: boolean; isMaturityService?: boolean }
    ) => void
    onGroupVariantChange?: (index: number, groupId: string, variantIds: string[]) => void
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
    onGroupVariantChange,
    planSurcharges = EMPTY_SURCHARGES,
}: Props) {
    /** 保存済み variant の店舗が現在の顧客店舗と一致しないか判定 */
    const isStoreMismatch = (item: DocumentItem | undefined): boolean => {
        const variantStoreId = item?.productVariant?.storeId
        if (!variantStoreId) return false // 全店舗共通 variant は OK
        return String(variantStoreId) !== String(currentStoreId ?? '')
    }

    /** その行に適用中の増額。選択肢がマスタから消えていても、保存済みの額から表示を復元する */
    const selectedSurchargeOf = (item: DocumentItem | undefined): { label: string; amount: number } | null => {
        if (!item?.surchargeAmount) return null
        const fromMaster = planSurcharges.find((s) => String(s.id) === String(item.planSurchargeId))
        if (fromMaster) return { label: fromMaster.label, amount: fromMaster.amount }
        return { label: `+¥${item.surchargeAmount.toLocaleString()}`, amount: item.surchargeAmount }
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
    // ダイアログで選択中の増額。'' は「増額なし」
    const [pendingSurchargeId, setPendingSurchargeId] = useState<string>('')
    const [pendingAdhocSetScope, setPendingAdhocSetScope] = useState<
        'NONE' | 'MEMBER_ONLY' | 'BOTH'
    >('NONE')
    const [pendingMultiVariantIds, setPendingMultiVariantIds] = useState<string[]>([])
    // グループ商品（重箱など）: groupId -> 選択中の variantId 配列
    const [pendingGroupSelections, setPendingGroupSelections] = useState<Record<string, string[]>>({})
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
    const [checkedItems, setCheckedItems] = useState<boolean[]>([])
    // 数量入力欄で Enter を押した際、次の商品のチェックボックスへ明示的にフォーカスを移すための参照
    // (端末・ブラウザによって Enter キーのフォーカス移動挙動が異なるため、挙動を統一する)
    const checkboxRefs = useRef<Record<number, HTMLInputElement | null>>({})
    const focusNextCheckbox = (fromIndex: number) => {
        for (let i = fromIndex + 1; i < items.length; i++) {
            const el = checkboxRefs.current[i]
            if (el) {
                el.focus()
                return
            }
        }
    }
    const [prevQtySignature, setPrevQtySignature] = useState('')
    const [freeCheckedItems, setFreeCheckedItems] = useState<boolean[]>([])
    const [prevFreeSignature, setPrevFreeSignature] = useState('')

    // 種類列: 選択されたバリアント名を連結した文字列がこの文字数を超えたら集約表示にする
    const [expandedTypeRows, setExpandedTypeRows] = useState<Set<number>>(new Set())
    const toggleTypeRow = (index: number) => {
        setExpandedTypeRows((prev) => {
            const next = new Set(prev)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }
    const renderTypeNames = (index: number, names: string[]): React.ReactNode => {
        if (names.length === 0) return '-'
        const joined = names.join('、')
        const label = `${joined}（${names.length}種類）`
        if (label.length <= TYPE_COLUMN_COLLAPSE_THRESHOLD) return label
        const isExpanded = expandedTypeRows.has(index)
        return (
            <>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTypeRow(index)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleTypeRow(index)
                        }
                    }}
                    className="flex cursor-pointer items-center gap-2"
                    style={{ color: 'var(--brand-navy)', fontWeight: 600 }}
                >
                    <span
                        className="font-mincho"
                        style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#eef0fb',
                            color: 'var(--brand-navy)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {names.length}種類選択中
                    </span>
                    <span style={{ color: 'var(--brand-gold-soft)', fontSize: '11px', flexShrink: 0 }}>
                        {isExpanded ? '▴ 閉じる' : '▾ 詳細'}
                    </span>
                </div>
                {isExpanded && (
                    <div
                        style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px dashed var(--brand-border)',
                            color: 'var(--brand-text-muted)',
                        }}
                    >
                        {joined}
                    </div>
                )}
            </>
        )
    }

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
                const isFixedRow = name === '満期サービス' || name === '解約手数料' || name === EXECUTION_SURCHARGE_NAME
                // 固定行（満期サービス・解約手数料・施行割増券）は qty>0 のときのみチェック扱い。
                // 通常フリー行は qty>0 または品目名入力済みなら有効扱い。
                if (isFixedRow) return qty > 0
                return qty > 0 || name !== ''
            })
        )
    }

    const openVariantDialog = (index: number) => {
        const item = items[index]
        const isMulti = !!item?.productRowId
        // 適用中の増額を選択状態に復元する
        setPendingSurchargeId(item?.planSurchargeId ? String(item.planSurchargeId) : '')
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
        } else if (item?.productItem?.hasVariantGroups) {
            try {
                setPendingGroupSelections(item?.groupSelections ? JSON.parse(item.groupSelections) : {})
            } catch { setPendingGroupSelections({}) }
            setPendingVariant(null)
            setPendingMultiVariantIds([])
            setPendingRowVariant(null)
            setPendingRowVariantsMap({})
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
            setPendingGroupSelections({})
        }
        setPendingIsService(!!item?.isService)
        setPendingIsMaturityService(!!item?.isMaturityService)
        // 子商品は adhocSetScope を引き継がない（子商品では adhocSetScope UI が非表示のため）
        const isThisChildItem = !!item?.productItem?.isSetChild
        const adhoc = (item as any)?.adhocSetScope
        setPendingAdhocSetScope(
            !isThisChildItem && (adhoc === 'MEMBER_ONLY' || adhoc === 'BOTH') ? adhoc : 'NONE'
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
            } else if (item?.productItem?.hasVariantGroups) {
                for (const group of item.productItem.variantGroups || []) {
                    onGroupVariantChange?.(
                        variantDialogIndex,
                        String(group.id),
                        pendingGroupSelections[String(group.id)] || []
                    )
                }
                const hasAnySelection = Object.values(pendingGroupSelections).some((ids) => ids.length > 0)
                if (hasAnySelection && !(item.qty && item.qty > 0)) {
                    setValue?.(
                        `items.${variantDialogIndex}.qty` as `items.${number}.qty`,
                        1,
                        { shouldDirty: true }
                    )
                }
            } else if (item?.productItem?.isMultiSelect) {
                onMultiSelectChange?.(variantDialogIndex, pendingMultiVariantIds, {
                    adhocSetScope: pendingAdhocSetScope,
                    isService: pendingIsService,
                    isMaturityService: pendingIsMaturityService,
                })
            } else if (pendingVariant) {
                // 増額を選べるのは親祭壇だけ。それ以外の商品では常に未選択として扱う
                const surchargeMaster = canApplySurcharge(item?.productItem)
                    ? planSurcharges.find((s) => String(s.id) === pendingSurchargeId)
                    : undefined
                onVariantChange?.(variantDialogIndex, pendingVariant, {
                    isService: pendingIsService,
                    isMaturityService: pendingIsMaturityService,
                    adhocSetScope: pendingAdhocSetScope,
                    surcharge: surchargeMaster
                        ? { id: String(surchargeMaster.id), amount: surchargeMaster.amount }
                        : null,
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
        setPendingGroupSelections({})
        setPendingIsService(false)
        setPendingAdhocSetScope('NONE')
        setPendingSurchargeId('')
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

    // 複数行構成商品グループ・グループ商品（重箱など、保存後は複数行に展開済み）:
    // 連続する同 productItemId の行を1まとまりとして扱う
    // 各 index に対して、グループ先頭の index を記録（先頭なら自分自身）
    const isGroupableRow = (item: DocumentItem | undefined): boolean =>
        !!item?.productRowId || !!item?.productVariantGroupId
    const groupStartIndexOf = (idx: number): number => {
        const item = items[idx]
        if (!isGroupableRow(item)) return idx // 通常商品は単独グループ
        const pid = String(item.productItemId)
        let start = idx
        while (start > 0) {
            const prev = items[start - 1]
            if (!isGroupableRow(prev) || String(prev.productItemId) !== pid) break
            start--
        }
        return start
    }
    const groupSizeOf = (startIdx: number): number => {
        const item = items[startIdx]
        if (!isGroupableRow(item)) return 1
        const pid = String(item.productItemId)
        let count = 0
        for (let i = startIdx; i < items.length; i++) {
            const it = items[i]
            if (!isGroupableRow(it) || String(it.productItemId) !== pid) break
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
        // (プラン設定で疑似セット子化された一般商品(isPlanForcedSet)は親子セット関係を持たないため対象外)
        if (pi.isSetChild && !pi.isPlanForcedSet) {
            return selectedParentChildIds.has(String(item.productItemId))
        }
        // 一般商品: 常に表示
        return true
    }
    return (
        <div className="mb-8">
            <h3 className="mb-4">明細</h3>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="w-16 min-w-[64px] border border-gray-300 p-1 text-center">有無</th>
                        <th className="w-56 min-w-[224px] lg:w-64 lg:min-w-[256px] border border-gray-300 p-3 text-center">品目</th>
                        <th className="w-16 min-w-[64px] border border-gray-300 p-3 text-center">操作</th>
                        <th className="w-32 min-w-[128px] border border-gray-300 p-3 text-center">数量</th>
                        <th className="w-80 min-w-[320px] border border-gray-300 p-3 text-center">種類</th>
                        <th className="min-w-[300px] border border-gray-300 p-3 text-center">摘要</th>
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
                                // adhocSetScope は非子商品専用。isSetChild=true の商品には適用しない
                                const adhocScope = (item as any)?.adhocSetScope
                                const isAdhocSetIncluded =
                                    !isChild && (
                                        adhocScope === 'BOTH' ||
                                        (adhocScope === 'MEMBER_ONLY' && isMember) ||
                                        (adhocScope === 'GENERAL_ONLY' && !isMember)
                                    )
                                // 複数行構成商品(車種行+距離加算行等)は、固定料金の加算行のみセット対象とする
                                const isMultiRowFixedSetIncluded =
                                    !!(
                                        isChild &&
                                        item?.productRowId &&
                                        item?.calcType === 'FIXED' &&
                                        (item?.sign ?? 1) === 1 &&
                                        scopeApplies(item?.productItem?.setableScope, isMember)
                                    )
                                // 子商品 + 初期セット種類 + setableScope が現在モードに適用: セット扱い
                                const isSetIncluded =
                                    !!(
                                        isChild &&
                                        item?.productVariant?.isDefaultSet &&
                                        scopeApplies(item?.productItem?.setableScope, isMember)
                                    ) || isMultiRowFixedSetIncluded || isAdhocSetIncluded
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
                                // 商品マスタから消えた商品を保存済み明細から復元した行。
                                // 選べる種類がもう存在しないため、種類の選び直しはさせない
                                const isMissingFromMaster = !!item?.productItem?.isMissingFromMaster
                                const canSelectVariant =
                                    !isMissingFromMaster && (checkedItems[index] || isLinkedChildOfSelectedParent)
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
                                // グループ化して表示すべきか（複数行構成商品、または保存後に複数行展開されたグループ商品）
                                const isGroupableItem = isMultiRowItem || !!item?.productVariantGroupId
                                // グループ内で1つでもチェックされているか（商品単位の表示状態）
                                const groupAnyChecked = (() => {
                                    if (!isMultiRowItem && !item?.productVariantGroupId) return checkedItems[index] ?? false
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
                                        {(!isGroupableItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-1 text-center"
                                                rowSpan={isGroupableItem ? groupSize : undefined}
                                            >
                                                {!readOnly && (
                                                    <input
                                                        type="checkbox"
                                                        ref={(el) => {
                                                            checkboxRefs.current[index] = el
                                                        }}
                                                        checked={isGroupableItem ? groupAnyChecked : (checkedItems[index] ?? false)}
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
                                                                        !it?.productItem?.isPlanForcedSet &&
                                                                        childIds.has(String(it.productItemId))
                                                                    ) {
                                                                        childIndexes.push(i)
                                                                    }
                                                                })
                                                            }

                                                            // 複数行構成商品・グループ商品: 同グループの全行 index を取得
                                                            const groupIndexes: number[] = isGroupableItem
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
                                                            // 返品行（sign=-1）は数量のデフォルトを常に 0 にする
                                                            for (const gi of groupIndexes) {
                                                                const gItem = items[gi]
                                                                const isReturnRow = (gItem?.sign ?? 1) === -1
                                                                const defaultQty = isReturnRow ? 0 : (gItem?.productRow?.defaultQty ?? 1)
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
                                                                const childItem = items[ci]
                                                                const childVariantName = childItem?.productVariant?.name
                                                                if (checked && childItem?.productItem?.overwriteDescriptionOnVariantChange && childVariantName) {
                                                                    setValue?.(
                                                                        `items.${ci}.description` as `items.${number}.description`,
                                                                        childVariantName,
                                                                        { shouldDirty: true }
                                                                    )
                                                                }
                                                            }

                                                            // canAddFreeRow=ON の商品: チェックを外したら紐づくフリー行の数量を0にリセット（合計計算に残らないようにする）
                                                            if (!checked) {
                                                                for (const gi of [...groupIndexes, ...childIndexes]) {
                                                                    const gItem = items[gi]
                                                                    if (!gItem?.productItem?.canAddFreeRow) continue
                                                                    const pid = String(gItem.productItemId ?? '')
                                                                    const fiIndex = (watchedFreeItems ?? []).findIndex(
                                                                        (fi: any) => fi?.parentProductItemId && String(fi.parentProductItemId) === pid
                                                                    )
                                                                    if (fiIndex >= 0) {
                                                                        setValue?.(
                                                                            `freeItems.${fiIndex}.qty` as `freeItems.${number}.qty`,
                                                                            0,
                                                                            { shouldDirty: true }
                                                                        )
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="h-5 w-5 cursor-pointer"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        {(!isGroupableItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-3"
                                                rowSpan={isGroupableItem ? groupSize : undefined}
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
                                                    {/* 品名は保存時点の控えを優先する（商品マスタで改名しても保存済み書類の文言を変えない） */}
                                                    <span>{displayProductItemName(item, item?.productItem?.name) || '-'}</span>
                                                    {isMissingFromMaster && (
                                                        <span
                                                            className="font-mincho"
                                                            title="この商品は商品マスタから削除（無効化）されています。保存済みの内容をそのまま表示しています。種類の選び直しはできません。"
                                                            style={{
                                                                fontSize: '10px',
                                                                padding: '2px 6px',
                                                                backgroundColor: 'var(--brand-red)',
                                                                color: '#ffffff',
                                                                letterSpacing: '0.1em',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            ⚠ {MISSING_FROM_MASTER_LABEL}
                                                        </span>
                                                    )}
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
                                                {groupAnyChecked &&
                                                    item?.productItem?.showProductVariantName &&
                                                    (item?.productVariant?.abbreviatedName ?? item?.productRowVariant?.abbreviatedName) && (
                                                    <div
                                                        style={{ fontSize: '10px', color: 'var(--brand-text-muted)' }}
                                                    >
                                                        （{item.productVariant?.abbreviatedName ?? item.productRowVariant?.abbreviatedName}）
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                        {(!isGroupableItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-3 text-center"
                                                rowSpan={isGroupableItem ? groupSize : undefined}
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
                                                disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
                                                onKeyDown={(e) => {
                                                    if (e.key !== 'Enter') return
                                                    e.preventDefault()
                                                    // 端末・ブラウザによって Enter キーのフォーカス移動先が異なるため、
                                                    // 次の商品のチェックボックスへ明示的にフォーカスを移す
                                                    const gStart = groupStartIndexOf(index)
                                                    const gSize = groupSizeOf(gStart)
                                                    const groupEndIndex = isGroupableItem ? gStart + gSize - 1 : index
                                                    focusNextCheckbox(groupEndIndex)
                                                }}
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-3">
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
                                                                    return renderTypeNames(index, names)
                                                                } catch { return '-' }
                                                              })()
                                                            : (item?.productItem?.hasVariantGroups && item?.multiSelectVariantIds)
                                                            ? (() => {
                                                                try {
                                                                    const ids: string[] = JSON.parse(item.multiSelectVariantIds as string)
                                                                    const allVariants = (item?.productItem?.variantGroups || []).flatMap(
                                                                        (g: any) => g.variants || []
                                                                    )
                                                                    const names = allVariants
                                                                        .filter((v: any) => ids.includes(String(v.id)))
                                                                        .map((v: any) => v.name)
                                                                    return renderTypeNames(index, names)
                                                                } catch { return '-' }
                                                              })()
                                                            : (item?.productItem?.hasVariantGroups && item?.groupSelections)
                                                            ? (() => {
                                                                try {
                                                                    const selections: Record<string, string[]> = JSON.parse(item.groupSelections as string)
                                                                    const names: string[] = []
                                                                    for (const group of item?.productItem?.variantGroups || []) {
                                                                        const ids = selections[String(group.id)] || []
                                                                        names.push(
                                                                            ...(group.variants || [])
                                                                                .filter((v: any) => ids.includes(String(v.id)))
                                                                                .map((v: any) => v.name)
                                                                        )
                                                                    }
                                                                    return renderTypeNames(index, names)
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
                                                    {/* 増額は帳票に行として出ないため、画面では金額が上乗せ済みであることを明示する */}
                                                    {selectedSurchargeOf(item) && (
                                                        <div
                                                            className="text-xs"
                                                            style={{ color: 'var(--brand-navy)', fontWeight: 600 }}
                                                        >
                                                            {selectedSurchargeOf(item)?.label} 適用
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        {(!isGroupableItem || isGroupStart) && (
                                            <td
                                                className="border border-gray-300 p-3"
                                                rowSpan={isGroupableItem ? groupSize : undefined}
                                            >
                                                <FormTextarea
                                                    name={`items.${index}.description`}
                                                    control={control}
                                                    rows={2}
                                                    noResize
                                                    maxRows={2}
                                                    disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                        )}
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
                                                    disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
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
                                                    disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
                                                    onKeyDown={(e) => {
                                                        if (e.key !== 'Enter') return
                                                        e.preventDefault()
                                                        const gStart = groupStartIndexOf(index)
                                                        const gSize = groupSizeOf(gStart)
                                                        const groupEndIndex = isGroupableItem ? gStart + gSize - 1 : index
                                                        focusNextCheckbox(groupEndIndex)
                                                    }}
                                                />
                                            </td>
                                            <td className="border border-gray-300 p-3">
                                                <FormCurrencyInput
                                                    name={`freeItems.${linkedFreeIndex}.unitPriceGeneral`}
                                                    control={control}
                                                    disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
                                                />
                                            </td>
                                            <td className="border border-gray-300 p-3">
                                                <FormTextarea
                                                    name={`freeItems.${linkedFreeIndex}.description`}
                                                    control={control}
                                                    rows={2}
                                                    noResize
                                                    maxRows={2}
                                                    disabled={isGroupableItem ? !groupAnyChecked : !checkedItems[index]}
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
                                const isExecutionSurcharge = itemName === EXECUTION_SURCHARGE_NAME
                                const isFixedRow = isMaturity || isCancellationFee || isExecutionSurcharge
                                const amount = isChecked
                                    ? isFixedRow
                                        ? liveUnitPrice
                                        : liveUnitPrice * liveQty
                                    : 0
                                const rowBgClass = isMaturity
                                    ? 'bg-amber-50'
                                    : isCancellationFee
                                      ? 'bg-rose-50'
                                      : isExecutionSurcharge
                                        ? 'bg-orange-50'
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
                                                <td className="border border-gray-300 p-3">
                                                    {isExecutionSurcharge ? (
                                                        <div className="text-md">¥{amount.toLocaleString()}</div>
                                                    ) : (
                                                        <>
                                                            <FormCurrencyInput
                                                                name={`freeItems.${index}.unitPriceGeneral`}
                                                                control={control}
                                                                disabled={inputsDisabled}
                                                            />
                                                            <div className="text-md mt-1">
                                                                ¥{amount.toLocaleString()}
                                                            </div>
                                                        </>
                                                    )}
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
                                                <td className="border border-gray-300 p-3">
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
            </div>

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
                            const hasVariantGroupsProduct = !!item?.productItem?.hasVariantGroups
                            const variantGroups = hasVariantGroupsProduct
                                ? item?.productItem?.variantGroups || []
                                : []
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
                            return (
                                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                    <p className="mb-4 text-lg font-medium">{item?.productItem?.name}</p>
                                    {/* 親祭壇の増額。帳票には行として出ず、会員価格に上乗せされた金額で表示される */}
                                    {canApplySurcharge(item?.productItem) && planSurcharges.length > 0 && (
                                        <div
                                            className="mb-4"
                                            style={{ padding: '12px 14px', border: '1px solid var(--brand-border)' }}
                                        >
                                            <div className="mb-2 font-mincho text-sm">増額</div>
                                            <select
                                                value={pendingSurchargeId}
                                                onChange={(e) => setPendingSurchargeId(e.target.value)}
                                                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none"
                                                style={{ fontFamily: 'var(--font-mincho)', fontSize: '14px' }}
                                            >
                                                <option value="">増額なし</option>
                                                {planSurcharges.map((s) => (
                                                    <option key={s.id} value={String(s.id)}>
                                                        {s.label}（+¥{s.amount.toLocaleString()}）
                                                    </option>
                                                ))}
                                            </select>
                                            <p
                                                className="mt-2 font-mincho"
                                                style={{ fontSize: '12px', color: 'var(--brand-text-muted)' }}
                                            >
                                                一般価格・会員価格の両方に上乗せされます。帳票には増額の行は出ず、祭壇の金額が上乗せ後の金額になります。
                                            </p>
                                        </div>
                                    )}
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
                                    ) : hasVariantGroupsProduct ? (
                                        <div className="space-y-6">
                                            {variantGroups.length === 0 ? (
                                                <p className="text-gray-500">グループが登録されていません</p>
                                            ) : (
                                                variantGroups.map((group) => {
                                                    const selectedIds = pendingGroupSelections[String(group.id)] || []
                                                    const toggleSingle = (variantId: string) => {
                                                        setPendingGroupSelections((prev) => ({
                                                            ...prev,
                                                            [String(group.id)]: [variantId],
                                                        }))
                                                    }
                                                    const toggleMulti = (variantId: string) => {
                                                        setPendingGroupSelections((prev) => {
                                                            const current = prev[String(group.id)] || []
                                                            const next = current.includes(variantId)
                                                                ? current.filter((id) => id !== variantId)
                                                                : [...current, variantId]
                                                            return { ...prev, [String(group.id)]: next }
                                                        })
                                                    }
                                                    return (
                                                        <div key={group.id}>
                                                            <p className="mb-1 text-base font-medium" style={{ color: 'var(--brand-navy)' }}>
                                                                {group.label}
                                                            </p>
                                                            <p className="mb-3 text-sm" style={{ color: 'var(--brand-text-muted)' }}>
                                                                {group.selectionType === 'SINGLE'
                                                                    ? '1つ選択してください'
                                                                    : '複数選択可（タップで選択・解除）'}
                                                            </p>
                                                            {group.variants.length === 0 ? (
                                                                <p className="text-gray-500 mb-4">種類が登録されていません</p>
                                                            ) : (
                                                                <div className="mb-4 grid grid-cols-3 gap-3">
                                                                    {group.variants.map((v: any) => {
                                                                        const isSelected = selectedIds.includes(String(v.id))
                                                                        return (
                                                                            <button
                                                                                key={v.id}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    group.selectionType === 'SINGLE'
                                                                                        ? toggleSingle(String(v.id))
                                                                                        : toggleMulti(String(v.id))
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
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
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
                                pendingMultiVariantIds.length === 0 &&
                                Object.values(pendingGroupSelections).every((ids) => ids.length === 0)
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
