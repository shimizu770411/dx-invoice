'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Control, FieldArrayWithId, UseFormSetValue, useWatch } from 'react-hook-form'
import { FormInput } from '@/components/form/FormInput'
import { FormCurrencyInput } from '@/components/form/FormCurrencyInput'
import { FormTextarea } from '@/components/form/FormTextarea'
import { ImageOff } from 'lucide-react'
import { EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { ProductVariant } from '@/lib/products'
import { resolveProductImageUrl } from '@/lib/utils'

type Totals = {
    subtotal: number
    tax: number
    total: number
    membershipPaidAmount: number
    grandTotal: number
}

type Props = {
    items: EstimateItem[]
    fields: FieldArrayWithId<EstimateFormData, 'items', 'id'>[]
    control: Control<EstimateFormData>
    isMember: boolean
    totals: Totals
    onVariantChange?: (index: number, variant: ProductVariant) => void
    setValue?: UseFormSetValue<EstimateFormData>
    freeItems?: EstimateFreeItem[]
    freeFields?: FieldArrayWithId<EstimateFormData, 'freeItems', 'id'>[]
    currentStoreId?: string | null
}

type Step =
    | { kind: 'product'; productIndex: number }
    | { kind: 'free'; freeIndex: number }

export function EstimateItemWizard({
    items,
    fields,
    control,
    isMember,
    totals,
    onVariantChange,
    setValue,
    freeItems = [],
    freeFields = [],
    currentStoreId,
}: Props) {
    const isStoreMismatch = (it: any): boolean => {
        const variantStoreId = it?.productVariant?.storeId
        if (!variantStoreId) return false
        return String(variantStoreId) !== String(currentStoreId ?? '')
    }
    const [current, setCurrent] = useState(0)
    const watchedItems = useWatch({ control, name: 'items' }) as { qty: number; description: string }[]
    const watchedFreeItems = useWatch({ control, name: 'freeItems' }) as
        | { productItemName: string; description: string; unitPriceGeneral: number; qty: number }[]
        | undefined

    // 親排他ロジック: 選択中の親祭壇
    const selectedParentIndex = items.findIndex(
        (it: any, i) => it?.productItem?.isSetParent && (watchedItems?.[i]?.qty ?? it?.qty ?? 0) > 0
    )
    const selectedParentId = selectedParentIndex >= 0 ? String(items[selectedParentIndex]?.productItemId) : null
    const selectedParentChildIds = new Set<string>(
        selectedParentIndex >= 0
            ? ((items[selectedParentIndex] as any)?.productItem?.children || []).map((c: any) => String(c.id))
            : []
    )

    const isVisible = (it: any): boolean => {
        const pi = it?.productItem
        if (!pi) return true
        // 親祭壇は1つだけ（一般・会員共通）
        if (pi.isSetParent) {
            if (selectedParentId && String(it.productItemId) !== selectedParentId) return false
            return true
        }
        // 子商品は親祭壇に紐づくものだけ表示（一般・会員共通）
        if (pi.isSetChild) {
            return selectedParentChildIds.has(String(it.productItemId))
        }
        return true
    }

    // 表示対象のインデックス一覧（商品マスタ）
    const visibleIndexes = items.map((_, i) => i).filter((i) => isVisible(items[i]))

    // ステップ配列: 商品ステップ → フリー項目ステップ（5件）の順
    const productSteps: Step[] = visibleIndexes.map((i) => ({ kind: 'product', productIndex: i }))
    const freeSteps: Step[] = freeFields.map((_, i) => ({ kind: 'free', freeIndex: i }))
    const allSteps: Step[] = [...productSteps, ...freeSteps]
    const total = allSteps.length

    if (total === 0) {
        return (
            <div
                className="py-16 text-center font-mincho"
                style={{
                    color: 'var(--brand-text-muted)',
                    fontSize: '14px',
                    letterSpacing: '0.15em',
                }}
            >
                登録対象の商品がありません
            </div>
        )
    }

    const visiblePos = Math.min(current, total - 1)
    const step = allSteps[visiblePos]

    // 商品ステップ用の値
    const index = step.kind === 'product' ? step.productIndex : -1
    const item = step.kind === 'product' ? items[index] : null
    const variants = item?.productItem?.variants || []
    const currentQty = step.kind === 'product' ? watchedItems?.[index]?.qty ?? 0 : 0
    const selectedVariantId = item?.productVariantId

    // フリー項目ステップ用の値
    const freeIndex = step.kind === 'free' ? step.freeIndex : -1
    const freeQty = step.kind === 'free' ? watchedFreeItems?.[freeIndex]?.qty ?? 0 : 0
    const freeName = step.kind === 'free' ? watchedFreeItems?.[freeIndex]?.productItemName ?? '' : ''
    const freeUnitPrice =
        step.kind === 'free' ? watchedFreeItems?.[freeIndex]?.unitPriceGeneral ?? 0 : 0
    const isMaturityStep =
        step.kind === 'free' &&
        ((freeItems[freeIndex]?.productItemName ?? '') === '満期サービス' ||
            freeName === '満期サービス')
    const freeAmount = isMaturityStep ? freeUnitPrice : freeQty * freeUnitPrice

    // 非表示行は qty を 0 にする（フォーム状態のクリーンアップ・dirty化）
    items.forEach((it, i) => {
        if (!isVisible(it) && (watchedItems?.[i]?.qty ?? 0) > 0) {
            setValue?.(`items.${i}.qty` as `items.${number}.qty`, 0, { shouldDirty: true })
        }
    })

    const selectedCount = useMemo(() => {
        const productCount = (watchedItems || []).reduce((c, f) => c + (f?.qty > 0 ? 1 : 0), 0)
        const freeCount = (watchedFreeItems || []).reduce(
            (c, f) => c + (f?.qty > 0 && (f?.productItemName ?? '').trim() !== '' ? 1 : 0),
            0
        )
        return productCount + freeCount
    }, [watchedItems, watchedFreeItems])

    const handleSelectVariant = (v: ProductVariant) => {
        if (step.kind !== 'product') return
        onVariantChange?.(index, v)
        if (!currentQty || currentQty === 0) {
            setValue?.(`items.${index}.qty` as `items.${number}.qty`, 1, { shouldDirty: true })
        }
        // 種類変更を dirty 化
        setValue?.('_changeMarker' as any, String(Date.now()), { shouldDirty: true })
    }

    const handleSkip = () => {
        if (step.kind === 'product') {
            setValue?.(`items.${index}.qty` as `items.${number}.qty`, 0, { shouldDirty: true })
        } else {
            setValue?.(`freeItems.${freeIndex}.qty` as `freeItems.${number}.qty`, 0, {
                shouldDirty: true,
            })
        }
        goNext()
    }

    const goPrev = () => setCurrent((c) => Math.max(0, c - 1))
    const goNext = () => setCurrent((c) => Math.min(total - 1, c + 1))

    const progressPercent = Math.round(((visiblePos + 1) / total) * 100)

    const sideLabelStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mincho)',
        fontSize: '13px',
        color: 'var(--brand-text-muted)',
        letterSpacing: '0.1em',
    }
    const sideValueStyle: React.CSSProperties = {
        fontFamily: 'var(--font-garamond), var(--font-mincho)',
        fontSize: '14px',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--brand-text)',
        textAlign: 'right',
    }

    return (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 300px' }}>
            {/* === メインエリア === */}
            <div>
                {/* プログレスバー */}
                <div
                    className="mb-5 flex items-center gap-4"
                    style={{
                        padding: '14px 18px',
                        backgroundColor: 'var(--brand-ivory)',
                        border: '1px solid var(--brand-border)',
                    }}
                >
                    <div className="flex items-baseline gap-2">
                        <span
                            className="font-garamond"
                            style={{
                                fontSize: '11px',
                                color: 'var(--brand-gold-soft)',
                                letterSpacing: '0.25em',
                            }}
                        >
                            STEP
                        </span>
                        <span
                            className="font-garamond"
                            style={{
                                fontSize: '20px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                            }}
                        >
                            {visiblePos + 1}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--brand-text-muted)' }}>
                            / {total}
                        </span>
                    </div>
                    <div className="flex-1">
                        <div
                            style={{
                                height: '4px',
                                backgroundColor: '#e0dbcc',
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    height: '100%',
                                    width: `${progressPercent}%`,
                                    backgroundColor: 'var(--brand-gold)',
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* 商品タイトル / フリー項目タイトル */}
                <div className="mb-5 flex items-end justify-between">
                    <div>
                        <p
                            className="font-garamond mb-1"
                            style={{
                                fontSize: '11px',
                                color: 'var(--brand-gold-soft)',
                                letterSpacing: '0.3em',
                            }}
                        >
                            {isMaturityStep
                                ? 'MATURITY SERVICE'
                                : step.kind === 'free'
                                  ? 'FREE ITEM'
                                  : 'PRODUCT'}
                        </p>
                        <h2
                            className="font-mincho"
                            style={{
                                fontSize: '22px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.2em',
                            }}
                        >
                            {isMaturityStep
                                ? '満期サービス'
                                : step.kind === 'free'
                                  ? `フリー項目 ${freeIndex + 1}`
                                  : item?.productItem?.name ?? '-'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {step.kind === 'product' && currentQty > 0 && isStoreMismatch(item) && (
                            <div
                                className="font-mincho"
                                title="保存済みの種類が現在の顧客の担当店舗で利用できません。種類を選び直してください。"
                                style={{
                                    padding: '6px 14px',
                                    backgroundColor: 'var(--brand-red)',
                                    color: '#ffffff',
                                    fontSize: '12px',
                                    letterSpacing: '0.1em',
                                    fontWeight: 600,
                                }}
                            >
                                ⚠ 店舗変更により利用不可
                            </div>
                        )}
                        {step.kind === 'product' && currentQty > 0 && item?.productVariant && (
                            <div
                                className="font-mincho"
                                style={{
                                    padding: '6px 14px',
                                    border: '1px solid var(--brand-navy)',
                                    color: 'var(--brand-navy)',
                                    fontSize: '13px',
                                    letterSpacing: '0.15em',
                                }}
                            >
                                選択中: {item.productVariant.name}
                            </div>
                        )}
                    </div>
                </div>

                {/* バリエーションカード（商品ステップのみ） */}
                {step.kind === 'product' && (variants.length === 0 ? (
                    <div
                        className="py-10 text-center font-mincho mb-5"
                        style={{
                            color: 'var(--brand-text-muted)',
                            fontSize: '14px',
                            letterSpacing: '0.15em',
                            border: '1px dashed var(--brand-border)',
                        }}
                    >
                        種類がありません
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4 mb-5">
                        {variants.map((v) => {
                            const isSelected = selectedVariantId === v.id
                            const img = resolveProductImageUrl(v.imageUrl)
                            return (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleSelectVariant(v)}
                                    className="transition-all overflow-hidden"
                                    style={{
                                        border: isSelected
                                            ? '2px solid var(--brand-navy)'
                                            : '1px solid var(--brand-border)',
                                        backgroundColor: isSelected ? '#f5f6fc' : '#ffffff',
                                        padding: '0',
                                        textAlign: 'left',
                                        boxShadow: isSelected
                                            ? '0 4px 12px rgba(1, 8, 62, 0.15)'
                                            : '0 1px 3px rgba(1, 8, 62, 0.05)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div
                                        className="flex items-center justify-center overflow-hidden relative"
                                        style={{
                                            width: '100%',
                                            aspectRatio: '4 / 3',
                                            backgroundColor: 'var(--brand-ivory)',
                                            borderBottom: '1px solid var(--brand-border)',
                                        }}
                                    >
                                        {img ? (
                                            <Image
                                                src={img}
                                                alt={v.name}
                                                fill
                                                sizes="300px"
                                                className="object-contain"
                                                style={{ padding: '4px' }}
                                            />
                                        ) : (
                                            <ImageOff
                                                className="h-12 w-12"
                                                style={{
                                                    color: 'var(--brand-gold-soft)',
                                                    opacity: 0.4,
                                                }}
                                            />
                                        )}
                                        {isSelected && (
                                            <div
                                                className="absolute top-2 right-2 flex items-center justify-center"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    backgroundColor: 'var(--brand-navy)',
                                                    color: '#ffffff',
                                                    borderRadius: '50%',
                                                    fontSize: '18px',
                                                }}
                                            >
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-3 py-2">
                                        <p
                                            className="font-mincho mb-1"
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 500,
                                                color: 'var(--brand-text)',
                                                letterSpacing: '0.08em',
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {v.name}
                                        </p>
                                        <p
                                            className="font-garamond"
                                            style={{
                                                fontSize: '17px',
                                                fontWeight: 600,
                                                color: 'var(--brand-navy)',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            ¥{(isMember ? v.priceMember : v.priceGeneral).toLocaleString()}
                                        </p>
                                        <p
                                            className="font-mincho"
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--brand-gold-soft)',
                                                letterSpacing: '0.1em',
                                            }}
                                        >
                                            {isMember ? '会員価格' : '一般価格'}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ))}

                {/* 数量・摘要入力（商品ステップ） */}
                {step.kind === 'product' && currentQty > 0 && (
                    <div
                        className="grid grid-cols-[140px_1fr] gap-5 mb-5"
                        style={{
                            padding: '20px 24px',
                            backgroundColor: 'var(--brand-ivory-light)',
                            border: '1px solid var(--brand-border)',
                        }}
                    >
                        <div>
                            <FormInput
                                name={`items.${index}.qty`}
                                control={control}
                                label="数量"
                                type="number"
                            />
                        </div>
                        <div>
                            <FormTextarea
                                name={`items.${index}.description`}
                                control={control}
                                label="摘要"
                                rows={2}
                                noResize
                                maxRows={2}
                            />
                        </div>
                    </div>
                )}

                {/* フリー項目入力（フリーステップ） */}
                {step.kind === 'free' && !isMaturityStep && (
                    <div
                        className="mb-5"
                        style={{
                            padding: '24px 28px',
                            backgroundColor: 'var(--brand-ivory-light)',
                            border: '1px solid var(--brand-border)',
                        }}
                    >
                        <p
                            className="font-mincho mb-4"
                            style={{
                                fontSize: '13px',
                                color: 'var(--brand-text-muted)',
                                letterSpacing: '0.1em',
                            }}
                        >
                            商品マスタにない項目を自由に入力できます。品目名と数量を入力すると保存対象になります。
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                            <FormInput
                                name={`freeItems.${freeIndex}.productItemName`}
                                control={control}
                                label="品目名"
                                type="text"
                                placeholder="例：追加サービス"
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormCurrencyInput
                                    name={`freeItems.${freeIndex}.unitPriceGeneral`}
                                    control={control}
                                    label="単価 (¥)"
                                />
                                <FormInput
                                    name={`freeItems.${freeIndex}.qty`}
                                    control={control}
                                    label="数量"
                                    type="number"
                                />
                            </div>
                            <FormTextarea
                                name={`freeItems.${freeIndex}.description`}
                                control={control}
                                label="摘要"
                                rows={2}
                                noResize
                                maxRows={2}
                            />
                        </div>
                        {freeQty > 0 && freeName.trim() !== '' && (
                            <div
                                className="mt-4 pt-4 flex items-baseline justify-end gap-3"
                                style={{ borderTop: '1px solid var(--brand-border)' }}
                            >
                                <span
                                    className="font-mincho"
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--brand-text-muted)',
                                        letterSpacing: '0.15em',
                                    }}
                                >
                                    金額
                                </span>
                                <span
                                    className="font-garamond"
                                    style={{
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        color: 'var(--brand-navy)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    ¥{freeAmount.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* 満期サービス入力（固定行） */}
                {step.kind === 'free' && isMaturityStep && (
                    <div
                        className="mb-5"
                        style={{
                            padding: '24px 28px',
                            backgroundColor: '#fdf6e8',
                            border: '1px solid var(--brand-gold)',
                        }}
                    >
                        <p
                            className="font-mincho mb-4"
                            style={{
                                fontSize: '13px',
                                color: 'var(--brand-text-muted)',
                                letterSpacing: '0.1em',
                            }}
                        >
                            満期サービスの金額を入力してください。「次へ」で確定します。
                        </p>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <FormCurrencyInput
                                name={`freeItems.${freeIndex}.unitPriceGeneral`}
                                control={control}
                                label="金額 (¥)"
                            />
                            <div
                                className="flex items-baseline justify-end gap-3"
                                style={{ paddingBottom: '8px' }}
                            >
                                <span
                                    className="font-mincho"
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--brand-text-muted)',
                                        letterSpacing: '0.15em',
                                    }}
                                >
                                    確定金額
                                </span>
                                <span
                                    className="font-garamond"
                                    style={{
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        color: 'var(--brand-navy)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    ¥{freeAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ナビゲーション */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={goPrev}
                        disabled={visiblePos === 0}
                        className="font-mincho transition-colors"
                        style={{
                            padding: '10px 24px',
                            backgroundColor: visiblePos === 0 ? '#f0eee8' : '#ffffff',
                            color: visiblePos === 0 ? '#c4bfb0' : 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            fontSize: '13px',
                            letterSpacing: '0.2em',
                            cursor: visiblePos === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        ← 戻る
                    </button>

                    <div className="flex gap-2">
                        {(step.kind === 'product' ? currentQty === 0 : freeQty === 0) ? (
                            <button
                                type="button"
                                onClick={handleSkip}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '10px 24px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-text-muted)',
                                    border: '1px dashed var(--brand-border)',
                                    fontSize: '13px',
                                    letterSpacing: '0.15em',
                                    cursor: 'pointer',
                                }}
                            >
                                {step.kind === 'free' ? 'この行は使わない' : 'この商品は選ばない'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (step.kind === 'product') {
                                        setValue?.(
                                            `items.${index}.qty` as `items.${number}.qty`,
                                            0,
                                            { shouldDirty: true }
                                        )
                                    } else {
                                        setValue?.(
                                            `freeItems.${freeIndex}.qty` as `freeItems.${number}.qty`,
                                            0,
                                            { shouldDirty: true }
                                        )
                                    }
                                }}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-red)',
                                    border: '1px solid var(--brand-red)',
                                    fontSize: '12px',
                                    letterSpacing: '0.15em',
                                    cursor: 'pointer',
                                }}
                            >
                                選択を解除
                            </button>
                        )}

                        {visiblePos < total - 1 ? (
                            <button
                                type="button"
                                onClick={goNext}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '10px 36px',
                                    backgroundColor: 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '13px',
                                    letterSpacing: '0.3em',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                                }}
                            >
                                次へ →
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="font-mincho"
                                style={{
                                    padding: '10px 36px',
                                    backgroundColor: 'var(--brand-gold)',
                                    color: 'var(--brand-navy-dark)',
                                    border: 'none',
                                    fontSize: '13px',
                                    letterSpacing: '0.3em',
                                    fontWeight: 500,
                                }}
                            >
                                最終ステップ
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* === 右サイドバー === */}
            <aside
                className="flex flex-col"
                style={{
                    position: 'sticky',
                    top: '16px',
                    alignSelf: 'start',
                    maxHeight: 'calc(100vh - 180px)',
                    border: '1px solid var(--brand-border)',
                    backgroundColor: '#ffffff',
                }}
            >
                {/* ナビゲーション見出し */}
                <div
                    className="flex items-center justify-between"
                    style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--brand-navy-dark)',
                        color: '#ffffff',
                        borderBottom: '2px solid var(--brand-gold)',
                    }}
                >
                    <span
                        className="font-mincho"
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                        }}
                    >
                        品目リスト
                    </span>
                    <span
                        className="font-garamond"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold)',
                            letterSpacing: '0.2em',
                        }}
                    >
                        {selectedCount} / {total}
                    </span>
                </div>

                {/* 品目リスト（スクロール） */}
                <div className="flex-1 overflow-y-auto">
                    {allSteps.map((s, posIdx) => {
                        const isCurrent = posIdx === visiblePos
                        let label: string
                        let qty = 0
                        let isSelected = false
                        let key: string
                        let rowKind: 'product' | 'free' | 'maturity' = 'product'
                        if (s.kind === 'product') {
                            const it = items[s.productIndex]
                            label = it?.productItem?.name ?? '-'
                            qty = watchedItems?.[s.productIndex]?.qty ?? 0
                            isSelected = qty > 0
                            key = `p-${it?.productItemId ?? s.productIndex}`
                        } else {
                            const fName =
                                (watchedFreeItems?.[s.freeIndex]?.productItemName ?? '').trim()
                            const isMat =
                                (freeItems[s.freeIndex]?.productItemName ?? '') === '満期サービス' ||
                                fName === '満期サービス'
                            rowKind = isMat ? 'maturity' : 'free'
                            label = isMat
                                ? '満期サービス'
                                : fName !== ''
                                  ? fName
                                  : `フリー項目 ${s.freeIndex + 1}`
                            qty = watchedFreeItems?.[s.freeIndex]?.qty ?? 0
                            isSelected = qty > 0 && fName !== ''
                            key = `f-${s.freeIndex}`
                        }
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setCurrent(posIdx)}
                                className="flex w-full items-center gap-2 transition-colors text-left"
                                style={{
                                    padding: '10px 16px',
                                    borderBottom: '1px solid var(--brand-border)',
                                    backgroundColor: isCurrent
                                        ? 'var(--brand-ivory)'
                                        : rowKind === 'maturity'
                                          ? '#fdf6e8'
                                          : rowKind === 'free'
                                            ? '#fafbff'
                                            : '#ffffff',
                                    borderLeft: isCurrent
                                        ? '3px solid var(--brand-gold)'
                                        : '3px solid transparent',
                                    fontFamily: 'var(--font-mincho)',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isCurrent) {
                                        e.currentTarget.style.backgroundColor =
                                            rowKind === 'maturity'
                                                ? '#fdf6e8'
                                                : rowKind === 'free'
                                                  ? '#fafbff'
                                                  : '#ffffff'
                                    }
                                }}
                            >
                                <span
                                    className="flex items-center justify-center flex-shrink-0"
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: isSelected
                                            ? 'var(--brand-navy)'
                                            : isCurrent
                                              ? 'var(--brand-gold)'
                                              : 'var(--brand-border)',
                                        color: isSelected || isCurrent ? '#ffffff' : 'var(--brand-text-muted)',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                    }}
                                >
                                    {isSelected ? '✓' : posIdx + 1}
                                </span>
                                {rowKind === 'free' && (
                                    <span
                                        className="font-mincho"
                                        style={{
                                            fontSize: '9px',
                                            padding: '1px 5px',
                                            backgroundColor: 'var(--brand-gold)',
                                            color: 'var(--brand-navy-dark)',
                                            letterSpacing: '0.08em',
                                            flexShrink: 0,
                                        }}
                                    >
                                        自由
                                    </span>
                                )}
                                {rowKind === 'maturity' && (
                                    <span
                                        className="font-mincho"
                                        style={{
                                            fontSize: '9px',
                                            padding: '1px 5px',
                                            backgroundColor: 'var(--brand-navy)',
                                            color: '#ffffff',
                                            letterSpacing: '0.08em',
                                            flexShrink: 0,
                                        }}
                                    >
                                        固定
                                    </span>
                                )}
                                <span
                                    className="flex-1 truncate"
                                    style={{
                                        fontSize: '13px',
                                        fontWeight: isCurrent ? 600 : 400,
                                        color: isCurrent
                                            ? 'var(--brand-navy)'
                                            : 'var(--brand-text)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    {label}
                                </span>
                                {isSelected && (
                                    <span
                                        className="font-garamond flex-shrink-0"
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-gold-soft)',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        ×{qty}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* 合計（サイドバー下部固定） */}
                <div
                    style={{
                        borderTop: '2px solid var(--brand-navy)',
                        backgroundColor: 'var(--brand-ivory)',
                        padding: '14px 16px',
                    }}
                >
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr' }}>
                        <span style={sideLabelStyle}>小　計</span>
                        <span style={sideValueStyle}>¥{totals.subtotal.toLocaleString()}</span>
                        <span style={sideLabelStyle}>消費税</span>
                        <span style={sideValueStyle}>¥{totals.tax.toLocaleString()}</span>
                        <span style={sideLabelStyle}>合　計</span>
                        <span style={sideValueStyle}>¥{totals.total.toLocaleString()}</span>
                        <span style={sideLabelStyle}>会費入金</span>
                        <span style={sideValueStyle}>
                            {totals.membershipPaidAmount > 0
                                ? `−¥${totals.membershipPaidAmount.toLocaleString()}`
                                : '¥0'}
                        </span>
                    </div>
                    <div
                        className="mt-3 pt-3 flex items-baseline justify-between"
                        style={{ borderTop: '1px solid var(--brand-border)' }}
                    >
                        <span
                            className="font-mincho"
                            style={{
                                fontSize: '13px',
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.25em',
                                fontWeight: 600,
                            }}
                        >
                            差引合計
                        </span>
                        <span
                            className="font-garamond"
                            style={{
                                fontSize: '22px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            ¥{totals.grandTotal.toLocaleString()}
                        </span>
                    </div>
                </div>
            </aside>
        </div>
    )
}
