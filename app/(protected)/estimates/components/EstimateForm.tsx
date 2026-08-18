'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, FormProvider, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { estimateFormSchema, EstimateFormData, DEFAULT_FORM_VALUES } from '../schemas/EstimateFormSchema'
import { useEstimateCreate, useEstimateEdit, calculateTotals } from '../hooks/useEstimateForm'
import { EstimateItemTable } from './EstimateItemTable'
import { EstimateItemWizard } from './EstimateItemWizard'
import { EstimateOtherFields } from './EstimateOtherFields'
import { EstimateCustomerSummary } from './EstimateCustomerSummary'
import { EstimateBasicInfo } from './EstimateBasicInfo'
import { ProductVariant } from '@/lib/products'
import { resolveUnitPriceMember } from '@/lib/itemPricing'
import { confirmEstimate } from '@/lib/estimates'
import { toast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

interface Estimate {
    id: string
    estimateType: 'PRE_CONSULTATION' | 'FORMAL'
    status: string
    docNo?: string | null
    hasInvoice?: boolean
}

interface ContentProps {
    mode: 'create' | 'edit'
    customer: any
    estimate?: Estimate
    items: any[]
    setItems: React.Dispatch<React.SetStateAction<any[]>>
    freeItems: any[]
    onSubmit: (data: EstimateFormData) => Promise<void>
    methods: UseFormReturn<EstimateFormData>
}

function LoadingState() {
    return (
        <div
            className="p-10"
            style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}
        >
            読み込み中…
        </div>
    )
}

function EstimateFormContent({ mode, customer, estimate, items, setItems, freeItems, onSubmit, methods }: ContentProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const {
        control,
        handleSubmit,
        setValue,
        formState: { isSubmitting, isDirty, errors },
    } = methods

    const { fields: itemFields } = useFieldArray({ control, name: 'items' })
    const { fields: freeItemFields } = useFieldArray({ control, name: 'freeItems' })

    const [activeTab, setActiveTab] = useState<'items' | 'other'>('items')
    const [itemsViewMode, setItemsViewMode] = useState<'list' | 'card'>('list')
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [pdfDialogOpen, setPdfDialogOpen] = useState(false)

    // 画面下部固定フッターの高さぶんコンテンツに余白を確保する（タブレット幅ではボタンが折り返してフッターが高くなるため、固定値ではなく実測値を使う）
    const footerRef = useRef<HTMLDivElement>(null)
    const [footerHeight, setFooterHeight] = useState(0)

    useEffect(() => {
        const el = footerRef.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            setFooterHeight(entries[0].contentRect.height)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const watchedItems = useWatch({ control, name: 'items' })
    const watchedFreeItems = useWatch({ control, name: 'freeItems' })
    const watchedIsMember = useWatch({ control, name: 'isMember' })

    useEffect(() => {
        if (mode === 'edit' && estimate) {
            setIsConfirmed(estimate.estimateType === 'PRE_CONSULTATION' && estimate.status === 'CONFIRMED')
        }
    }, [mode, estimate?.estimateType, estimate?.status])

    // 事前相談見積（本見積作成済み）、または請求書作成済みの本見積は編集不可にする
    const isLocked =
        mode === 'edit' && (isConfirmed || (estimate?.estimateType === 'FORMAL' && !!estimate?.hasInvoice))

    const handleVariantChange = (
        index: number,
        variant: ProductVariant | null,
        options?: {
            isService?: boolean
            isMaturityService?: boolean
            adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
            rowVariant?: any
        }
    ) => {
        const isMember = watchedIsMember === 'true'
        const isService = options?.isService ?? false
        const isMaturityService = options?.isMaturityService ?? false
        const adhocSetScope = options?.adhocSetScope ?? 'NONE'
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
                        isService,
                        isMaturityService,
                        adhocSetScope,
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
                    unitPriceGeneral: variant.priceGeneral,
                    unitPriceMember: isService || isMaturityService
                        ? 0
                        : resolveUnitPriceMember(item, variant, isMember),
                    isService,
                    isMaturityService,
                    adhocSetScope,
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
        const isMember = watchedIsMember === 'true'
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
                    isService: options?.isService ?? false,
                    isMaturityService: options?.isMaturityService ?? false,
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
                const hasAnySelection = Object.values(nextSelections).some((ids) => ids.length > 0)
                return {
                    ...item,
                    groupSelections: JSON.stringify(nextSelections),
                    unitPriceGeneral: allSelectedVariants.reduce((s, v) => s + v.priceGeneral, 0),
                    unitPriceMember: allSelectedVariants.reduce((s, v) => s + v.priceMember, 0),
                    qty: hasAnySelection ? 1 : 0,
                } as any
            })
        )
    }

    useEffect(() => {
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

    const totals = calculateTotals(items, watchedItems, watchedIsMember === 'true', customer, freeItems, watchedFreeItems)

    const onInvalid = (errs: any) => {
        const itemsError = errs?.items?.root?.message ?? errs?.items?.message
        if (itemsError) {
            toast({ title: itemsError, variant: 'destructive', duration: 3000 })
            return
        }
        const first = Object.values(errs as Record<string, any>).find((e) => e?.message)
        if (first?.message) {
            toast({ title: first.message, variant: 'destructive', duration: 3000 })
        }
    }

    const onSubmitWithStoreCheck = async (formValues: EstimateFormData) => {
        const customerStoreId = customer?.storeId ? String(customer.storeId) : ''
        const actionLabel = mode === 'create' ? '登録' : '更新'
        const mismatches = items
            .map((it, i) => {
                const qty = formValues.items[i]?.qty ?? it.qty
                if ((qty ?? 0) <= 0) return null
                const variantStoreId = (it as any).productVariant?.storeId
                if (!variantStoreId) return null
                if (String(variantStoreId) === customerStoreId) return null
                return (it as any).productItem?.name ?? '-'
            })
            .filter((n): n is string => !!n)
        if (mismatches.length > 0) {
            const ok = confirm(
                `以下の明細は店舗変更により現在の顧客では利用できない種類が紐付いています:\n\n・${mismatches.join('\n・')}\n\n種類を選び直すことを推奨します。このまま${actionLabel}してよろしいですか？`
            )
            if (!ok) return
        }
        return onSubmit(formValues)
    }

    const handleCreateFormal = async () => {
        if (!estimate) return
        if (isDirty) {
            toast({ title: '先に「更新」で保存してください', variant: 'destructive', duration: 3000 })
            return
        }
        if (!confirm('本見積を作成します。\n事前相談見積の内容をコピーして本見積を作成し、そちらに移動します。\nよろしいですか？')) return
        setIsConfirming(true)
        try {
            const result = await confirmEstimate(estimate.id)
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            toast({ title: '本見積を作成しました', variant: 'success', duration: 2000 })
            router.push(`/estimates/${result.id}`)
        } catch (e: any) {
            toast({ title: '本見積の作成に失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setIsConfirming(false)
        }
    }

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '14px 28px',
        fontSize: '15px',
        fontWeight: active ? 600 : 500,
        letterSpacing: '0.15em',
        fontFamily: 'var(--font-mincho)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: 'none',
        borderBottom: `3px solid ${active ? 'var(--brand-gold)' : 'transparent'}`,
        backgroundColor: active ? '#ffffff' : 'transparent',
        color: active ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
    })

    const pageTitle = mode === 'create'
        ? '見積書 作成'
        : estimate?.estimateType === 'FORMAL' ? '本見積 編集' : '事前相談見積 編集'

    // 折り返し時にPDFプレビューボタンと切り離れないよう、まとめて配置する
    const closeButton = (
        <button
            type="button"
            onClick={() => { router.push('/cases'); router.refresh() }}
            className="font-mincho transition-colors px-8 py-3"
            style={{
                backgroundColor: '#ffffff',
                color: 'var(--brand-text-muted)',
                border: '1px solid var(--brand-border)',
                fontSize: '15px',
                letterSpacing: '0.25em',
                fontWeight: 500,
                cursor: 'pointer',
            }}
        >
            閉じる
        </button>
    )

    const showTotals = itemsViewMode === 'list' || isLocked

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={handleSubmit(onSubmitWithStoreCheck, onInvalid)}
                className="flex flex-col px-10 py-8"
                style={{
                    backgroundColor: '#fbfaf7',
                    minHeight: 'calc(100vh - 68px)',
                    paddingBottom: footerHeight + 32,
                }}
            >
                {/* ページヘッダー */}
                <div
                    className="flex items-end justify-between mb-6 pb-5"
                    style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                    <div>
                        <p
                            className="font-garamond mb-2"
                            style={{ fontSize: '12px', color: 'var(--brand-gold-soft)', letterSpacing: '0.3em', fontWeight: 500 }}
                        >
                            {mode === 'create' ? 'ESTIMATE · NEW' : 'ESTIMATE · EDIT'}
                        </p>
                        <h1
                            className="font-mincho"
                            style={{ fontSize: '26px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.2em', lineHeight: 1.2 }}
                        >
                            {pageTitle}
                            {mode === 'edit' && estimate?.docNo && (
                                <span style={{ fontSize: '16px', color: 'var(--brand-text-muted)', fontWeight: 400, letterSpacing: '0.15em', marginLeft: '20px' }}>
                                    — No. {estimate.docNo}
                                </span>
                            )}
                        </h1>
                    </div>
                </div>

                {mode === 'edit' && isConfirmed && (
                    <div className="mb-4 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        本見積が作成済みのため、この事前相談見積は閲覧のみです。変更は本見積から行ってください。
                    </div>
                )}

                {mode === 'edit' && !isConfirmed && estimate?.estimateType === 'FORMAL' && estimate?.hasInvoice && (
                    <div className="mb-4 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        請求書が作成済みのため、この本見積は閲覧のみです。
                    </div>
                )}

                <EstimateCustomerSummary customer={customer} />

                {/* タブ */}
                <div className="flex" style={{ borderBottom: '2px solid var(--brand-border)', backgroundColor: '#fbfaf7' }}>
                    <button type="button" onClick={() => setActiveTab('items')} style={tabStyle(activeTab === 'items')}>明　細</button>
                    <button type="button" onClick={() => setActiveTab('other')} style={tabStyle(activeTab === 'other')}>各担当、備考欄</button>
                </div>

                {/* タブコンテンツ */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--brand-border)', borderTop: 'none', padding: '28px 32px' }}>
                    <fieldset disabled={isLocked} className="contents">
                        {activeTab === 'items' && (
                            <>
                                <EstimateBasicInfo
                                    control={control}
                                    isNew={mode === 'create'}
                                    disabled={isLocked}
                                />
                                {(errors.items?.root?.message ?? (errors.items as any)?.message) && (
                                    <p
                                        className="mb-4 font-mincho"
                                        style={{ marginTop: '-8px', fontSize: '14px', color: 'var(--brand-red)', letterSpacing: '0.05em' }}
                                    >
                                        {errors.items?.root?.message ?? (errors.items as any)?.message}
                                    </p>
                                )}

                                {!isLocked && (
                                    <div className="mb-5 flex items-center gap-1">
                                        <span className="font-garamond mr-3" style={{ fontSize: '11px', color: 'var(--brand-gold-soft)', letterSpacing: '0.3em' }}>
                                            MODE
                                        </span>
                                        {([
                                            { value: 'list', label: '一覧から登録', disabled: false },
                                            // カード型UIは実装方針検討中のため一時非活性（方針決定後に解除）
                                            { value: 'card', label: 'カード型で順番に選択', disabled: true },
                                        ] as const).map((opt) => {
                                            const active = itemsViewMode === opt.value
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    disabled={opt.disabled}
                                                    onClick={() => setItemsViewMode(opt.value)}
                                                    className="font-mincho transition-colors"
                                                    title={opt.disabled ? '実装検討中のため現在使用できません' : undefined}
                                                    style={{
                                                        padding: '8px 20px',
                                                        fontSize: '13px',
                                                        fontWeight: active ? 600 : 500,
                                                        letterSpacing: '0.15em',
                                                        backgroundColor: active ? 'var(--brand-navy)' : '#ffffff',
                                                        color: opt.disabled ? 'var(--brand-border)' : active ? '#ffffff' : 'var(--brand-text-muted)',
                                                        border: active ? '1px solid var(--brand-navy)' : '1px solid var(--brand-border)',
                                                        cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {itemsViewMode === 'list' || isLocked ? (
                                    <EstimateItemTable
                                        items={items}
                                        fields={itemFields}
                                        control={control}
                                        isMember={watchedIsMember === 'true'}
                                        freeItems={freeItems}
                                        freeFields={freeItemFields}
                                        onVariantChange={handleVariantChange}
                                        onMultiSelectChange={handleMultiSelectChange}
                                        onGroupVariantChange={handleGroupVariantChange}
                                        setValue={setValue}
                                        readOnly={isLocked}
                                        currentStoreId={customer?.storeId ? String(customer.storeId) : null}
                                    />
                                ) : (
                                    <EstimateItemWizard
                                        items={items}
                                        fields={itemFields}
                                        control={control}
                                        isMember={watchedIsMember === 'true'}
                                        totals={totals}
                                        onVariantChange={handleVariantChange}
                                        onMultiSelectChange={handleMultiSelectChange}
                                        onGroupVariantChange={handleGroupVariantChange}
                                        setValue={setValue}
                                        freeItems={freeItems}
                                        freeFields={freeItemFields}
                                        currentStoreId={customer?.storeId ? String(customer.storeId) : null}
                                    />
                                )}
                            </>
                        )}
                        {activeTab === 'other' && (
                            <EstimateOtherFields control={control} disabled={isLocked} />
                        )}
                    </fieldset>
                </div>

                {/* 操作ボタン & 合計（画面下部固定） */}
                <div
                    ref={footerRef}
                    className="fixed bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-3 px-10 py-3 lg:gap-6"
                    style={{
                        backgroundColor: '#ffffff',
                        borderTop: '1px solid var(--brand-border)',
                        boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                        zIndex: 40,
                    }}
                >
                    {showTotals ? (
                        <div
                            className="flex items-center gap-x-8 flex-wrap"
                            style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text)' }}
                        >
                            {[
                                { label: '小計', value: totals.subtotal, sign: '¥' },
                                { label: '消費税', value: totals.tax, sign: '¥' },
                                { label: '合計', value: totals.total, sign: '¥' },
                                { label: '会費入金', value: totals.membershipPaidAmount, sign: totals.membershipPaidAmount > 0 ? '−¥' : '¥' },
                            ].map((t) => (
                                <div key={t.label} className="flex items-baseline gap-2">
                                    <span style={{ fontSize: '12px', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>{t.label}</span>
                                    <span style={{ fontFamily: 'var(--font-garamond), var(--font-mincho)', fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                                        {t.sign}{t.value.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            <div className="basis-full lg:hidden" aria-hidden="true" />
                            <div className="ml-auto flex items-baseline gap-2 pl-4 lg:ml-0" style={{ borderLeft: '1px solid var(--brand-border)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--brand-navy)', letterSpacing: '0.25em', fontWeight: 600 }}>差引合計</span>
                                <span style={{ fontFamily: 'var(--font-garamond), var(--font-mincho)', fontSize: '24px', fontWeight: 600, color: 'var(--brand-navy)', fontVariantNumeric: 'tabular-nums' }}>
                                    ¥{totals.grandTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div />
                    )}

                    <div className="ml-auto flex flex-col items-end gap-1">
                        {mode === 'edit' && isDirty && (
                            <span className="font-mincho" style={{ fontSize: '12px', color: 'var(--brand-red)', letterSpacing: '0.15em' }}>
                                ※ 未保存の変更があります
                            </span>
                        )}
                        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                            {mode === 'create' ? (
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="font-mincho transition-colors text-white"
                                    style={{
                                        padding: '12px 48px',
                                        backgroundColor: isSubmitting ? '#7a7a7a' : 'var(--brand-navy)',
                                        border: 'none',
                                        fontSize: '15px',
                                        letterSpacing: '0.4em',
                                        fontWeight: 500,
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                                    }}
                                >
                                    {isSubmitting ? '保存中…' : '登　録'}
                                </button>
                            ) : estimate && (
                                <>
                                    {!isConfirmed && estimate.estimateType === 'PRE_CONSULTATION' && (
                                        <>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className={`font-mincho rounded border border-transparent px-10 py-3 text-[15px] text-white ${isSubmitting ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-[var(--brand-navy)]'}`}
                                            >
                                                {isSubmitting ? '保存中...' : '更新'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isConfirming || isDirty}
                                                onClick={handleCreateFormal}
                                                className={`font-mincho rounded border border-transparent px-8 py-3 text-[15px] text-white ${isConfirming || isDirty ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-[var(--brand-navy-light)]'}`}
                                                title={isDirty ? '先に「更新」で保存してください' : '事前相談見積から本見積を作成'}
                                            >
                                                {isConfirming ? '作成中...' : '本見積を作成'}
                                            </button>
                                        </>
                                    )}
                                    {isConfirmed && estimate.estimateType === 'PRE_CONSULTATION' && (
                                        <span className="inline-flex items-center whitespace-nowrap rounded border border-transparent bg-gray-200 px-4 py-3 text-[15px] text-gray-600">
                                            事前相談見積（本見積作成済み・閲覧のみ）
                                        </span>
                                    )}
                                    {estimate.estimateType === 'FORMAL' && (
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || estimate.hasInvoice}
                                            title={estimate.hasInvoice ? '請求書作成済みのため更新できません' : undefined}
                                            className={`font-mincho rounded border-0 px-5 py-3 text-[15px] text-white ${isSubmitting || estimate.hasInvoice ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-[var(--brand-navy)]'}`}
                                        >
                                            {isSubmitting ? '保存中...' : estimate.hasInvoice ? '更新不可（請求書作成済み）' : '更新（本見積）'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={isDirty}
                                        onClick={() => setPdfDialogOpen(true)}
                                        className={`font-mincho rounded px-10 py-3 text-[15px] ${isDirty ? 'cursor-not-allowed border border-transparent bg-gray-300 text-white' : 'cursor-pointer border border-[var(--brand-gold)] bg-[var(--brand-gold)] text-[var(--brand-navy-dark)]'}`}
                                    >
                                        PDF
                                    </button>
                                    <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
                                        <DialogContent className="max-w-md" style={{ borderColor: 'var(--brand-border)', borderRadius: '16px' }}>
                                            <DialogHeader>
                                                <DialogTitle
                                                    className="font-mincho"
                                                    style={{ color: 'var(--brand-navy)', fontSize: '19px', letterSpacing: '0.08em', fontWeight: 600 }}
                                                >
                                                    PDF出力設定
                                                </DialogTitle>
                                                <DialogDescription
                                                    className="font-mincho"
                                                    style={{ color: 'var(--brand-text-muted)', fontSize: '13px', letterSpacing: '0.03em', lineHeight: 1.8 }}
                                                >
                                                    各明細で選択した種類の画像を、PDF末尾に一覧ページとして含めますか？
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter className="!grid !grid-cols-2 gap-3 sm:space-x-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const params = new URLSearchParams({ _t: Date.now().toString(), showOptions: 'false' })
                                                        window.open(`/api/pdf/estimate/${estimate.id}?${params.toString()}`, '_blank')
                                                        setPdfDialogOpen(false)
                                                    }}
                                                    className="font-mincho cursor-pointer"
                                                    style={{
                                                        padding: '14px 12px',
                                                        backgroundColor: '#ffffff',
                                                        color: 'var(--brand-text-muted)',
                                                        border: '1px solid var(--brand-border)',
                                                        borderRadius: '10px',
                                                        fontSize: '14px',
                                                        letterSpacing: '0.1em',
                                                        lineHeight: 1.6,
                                                    }}
                                                >
                                                    含めない
                                                    <br />
                                                    （非表示）
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const params = new URLSearchParams({ _t: Date.now().toString() })
                                                        window.open(`/api/pdf/estimate/${estimate.id}?${params.toString()}`, '_blank')
                                                        setPdfDialogOpen(false)
                                                    }}
                                                    className="font-mincho cursor-pointer"
                                                    style={{
                                                        padding: '14px 12px',
                                                        backgroundColor: 'var(--brand-navy)',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        fontSize: '14px',
                                                        letterSpacing: '0.1em',
                                                        lineHeight: 1.6,
                                                    }}
                                                >
                                                    含めて出力
                                                    <br />
                                                    （表示）
                                                </button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </>
                            )}
                            {closeButton}
                        </div>
                    </div>
                </div>
            </form>
        </FormProvider>
    )
}

export function EstimateFormCreate({ customerId }: { customerId: string }) {
    const methods = useForm<EstimateFormData>({
        resolver: zodResolver(estimateFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    })
    const { loading, customer, items, setItems, freeItems, onSubmit } = useEstimateCreate(customerId, methods.reset)

    if (loading || !customer) return <LoadingState />

    return (
        <EstimateFormContent
            mode="create"
            customer={customer}
            items={items}
            setItems={setItems}
            freeItems={freeItems}
            onSubmit={onSubmit}
            methods={methods}
        />
    )
}

export function EstimateFormEdit({ estimateId }: { estimateId: string }) {
    const methods = useForm<EstimateFormData>({
        resolver: zodResolver(estimateFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    })
    const { loading, customer, estimate, items, setItems, freeItems, onSubmit } = useEstimateEdit(estimateId, methods.reset)

    if (loading || !customer || !estimate) return <LoadingState />

    return (
        <EstimateFormContent
            mode="edit"
            customer={customer}
            estimate={estimate}
            items={items}
            setItems={setItems}
            freeItems={freeItems}
            onSubmit={onSubmit}
            methods={methods}
        />
    )
}
