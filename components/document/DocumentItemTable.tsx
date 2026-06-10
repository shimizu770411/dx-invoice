'use client'

import { useState } from 'react'
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
    freeItems: { productItemName: string; description: string; unitPriceGeneral: number; qty: number }[]
}

type DocumentItem = {
    productItemId?: string | null
    productItem?: {
        name?: string | null
        variants?: ProductVariant[]
        isSetParent?: boolean
        isSetChild?: boolean
        isServiceable?: boolean
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
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    isService?: boolean
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
    onVariantChange?: (index: number, variant: ProductVariant, options?: { isService?: boolean }) => void
    setValue?: UseFormSetValue<DocumentFormData>
    readOnly?: boolean
    /** 顧客の現在の担当店舗 ID。保存済み variant の店舗と異なる場合に警告表示 */
    currentStoreId?: string | null
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
}: Props) {
    /** 保存済み variant の店舗が現在の顧客店舗と一致しないか判定 */
    const isStoreMismatch = (item: DocumentItem | undefined): boolean => {
        const variantStoreId = item?.productVariant?.storeId
        if (!variantStoreId) return false // 全店舗共通 variant は OK
        return String(variantStoreId) !== String(currentStoreId ?? '')
    }
    const [variantDialogIndex, setVariantDialogIndex] = useState<number | null>(null)
    const [pendingVariant, setPendingVariant] = useState<ProductVariant | null>(null)
    const [pendingIsService, setPendingIsService] = useState(false)
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
        const variants = item?.productItem?.variants || []
        const current = variants.find((v) => v.id === item?.productVariantId) || variants[0] || null
        setPendingVariant(current)
        setPendingIsService(!!item?.isService)
        setVariantDialogIndex(index)
    }

    const confirmVariant = () => {
        if (variantDialogIndex !== null && pendingVariant) {
            onVariantChange?.(variantDialogIndex, pendingVariant, { isService: pendingIsService })
            setValue?.(`items.${variantDialogIndex}.qty` as `items.${number}.qty`, 1, {
                shouldDirty: true,
            })
            // 種類変更を dirty 化（同じ qty でもフォームを汚す）
            setValue?.('_changeMarker' as any, String(Date.now()), { shouldDirty: true })
        }
        setVariantDialogIndex(null)
        setPendingVariant(null)
        setPendingIsService(false)
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
                        <th className="w-20 border border-gray-300 p-3 text-center">数量</th>
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
                                    if ((watchedItems?.[index]?.qty ?? 0) > 0) {
                                        setValue?.(`items.${index}.qty` as `items.${number}.qty`, 0, {
                                            shouldDirty: true,
                                        })
                                    }
                                    return null
                                }
                                const isParent = item?.productItem?.isSetParent
                                const isChild = item?.productItem?.isSetChild
                                // 子商品 + 初期セット種類: セット扱い（金額0、合計対象外、一般/会員共通）
                                const isSetIncluded = !!(
                                    isChild && item?.productVariant?.isDefaultSet
                                )
                                // サービス品フラグON: サービス扱い（金額0、合計対象外、一般/会員共通）
                                const isServiceIncluded = !!item?.isService
                                const isExcludedFromMember = isSetIncluded || isServiceIncluded
                                // 選択中の親祭壇に紐づく子セット行は qty=0 でも種類選択を許可（一般/会員共通）
                                const isLinkedChildOfSelectedParent =
                                    !!isChild &&
                                    selectedParentChildIds.has(String(item?.productItemId))
                                const canSelectVariant =
                                    checkedItems[index] || isLinkedChildOfSelectedParent
                                const unitPrice =
                                    item != null ? (isMember ? item.unitPriceMember : item.unitPriceGeneral) : 0
                                const liveQty = watchedItems?.[index]?.qty ?? item?.qty ?? 0
                                const amount = isExcludedFromMember ? 0 : unitPrice * liveQty
                                return (
                                    <tr
                                        key={field.id}
                                        style={isChild ? { backgroundColor: '#fcfaf2' } : undefined}
                                    >
                                        <td className="border border-gray-300 p-1 text-center">
                                            {!readOnly && (
                                                <input
                                                    type="checkbox"
                                                    checked={checkedItems[index] ?? false}
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

                                                        // checkedItems を一括更新
                                                        setCheckedItems((prev) => {
                                                            const next = [...prev]
                                                            next[index] = checked
                                                            for (const ci of childIndexes) {
                                                                next[ci] = checked
                                                            }
                                                            return next
                                                        })

                                                        // qty を一括更新（フォームを dirty 化）
                                                        setValue?.(
                                                            `items.${index}.qty` as `items.${number}.qty`,
                                                            checked ? 1 : 0,
                                                            { shouldDirty: true }
                                                        )
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
                                        <td className="border border-gray-300 p-3">
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
                                        <td className="border border-gray-300 p-3 text-center">
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
                                        <td className="border border-gray-300 p-3">
                                            <FormInput
                                                name={`items.${index}.qty`}
                                                control={control}
                                                type="number"
                                                disabled={!checkedItems[index]}
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-3 text-right">
                                            <div className="text-sm">{item?.productVariant?.name ?? '-'}</div>
                                            {isServiceIncluded ? (
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
                                        </td>
                                        <td className="border border-gray-300 p-3">
                                            <FormTextarea
                                                name={`items.${index}.description`}
                                                control={control}
                                                rows={2}
                                                noResize
                                                maxRows={2}
                                                disabled={!checkedItems[index]}
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                            {freeFields.map((field, index) => {
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
                            // サービス可フラグが立っていれば一般/会員問わずチェック可能
                            const canBeService = !!item?.productItem?.isServiceable
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
                                                onChange={(e) => setPendingIsService(e.target.checked)}
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
                                    {variants.length === 0 ? (
                                        <p className="text-gray-500">種類がありません</p>
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
                            disabled={!pendingVariant}
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
