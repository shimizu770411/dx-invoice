'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Suspense } from 'react'
import { estimateFormSchema, EstimateFormData, DEFAULT_FORM_VALUES } from '../schemas/EstimateFormSchema'
import { useEstimateCreate, calculateTotals } from '../hooks/useEstimateForm'
import { EstimateItemTable } from '../components/EstimateItemTable'
import { EstimateItemWizard } from '../components/EstimateItemWizard'
import { EstimateOtherFields } from '../components/EstimateOtherFields'
import { EstimateCustomerSummary } from '../components/EstimateCustomerSummary'
import { EstimateBasicInfo } from '../components/EstimateBasicInfo'
import { ProductVariant } from '@/lib/products'
import { resolveUnitPriceMember } from '@/lib/itemPricing'
import { toast } from '@/hooks/use-toast'

function EstimateNewPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const customerId = searchParams.get('customerId') ?? ''

    const methods = useForm<EstimateFormData>({
        resolver: zodResolver(estimateFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    })
    const {
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { isSubmitting, errors },
    } = methods

    const { fields: itemFields } = useFieldArray({ control, name: 'items' })

    const { fields: freeItemFields } = useFieldArray({ control, name: 'freeItems' })

    const { loading, customer, items, setItems, freeItems, onSubmit } = useEstimateCreate(customerId, reset)
    const [activeTab, setActiveTab] = useState<'items' | 'other'>('items')
    const [itemsViewMode, setItemsViewMode] = useState<'list' | 'card'>('list')
    const watchedItems = useWatch({ control, name: 'items' })
    const watchedIsMember = useWatch({ control, name: 'isMember' })

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
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                // 複数行構成行: rowVariant で更新
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
                return {
                    ...item,
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
                    unitPriceMember: isMember ? totalMember : totalGeneral,
                    adhocSetScope: options?.adhocSetScope ?? 'NONE',
                    isService: options?.isService ?? false,
                    isMaturityService: options?.isMaturityService ?? false,
                } as any
            })
        )
    }

    // 会員/一般切替時に、各 item の unitPriceMember を再計算
    // （会員時はセット品の setPrice、一般時は通常 priceMember）
    useEffect(() => {
        const isMember = watchedIsMember === 'true'
        setItems((prev) =>
            prev.map((item) => {
                if (!item.productVariant) return item
                const next = resolveUnitPriceMember(item, item.productVariant, isMember)
                return next === item.unitPriceMember ? item : { ...item, unitPriceMember: next }
            })
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedIsMember])

    if (loading) {
        return (
            <div
                className="p-10"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.15em',
                }}
            >
                読み込み中…
            </div>
        )
    }

    if (!customer) {
        return null
    }

    const totals = calculateTotals(items, watchedItems, watchedIsMember === 'true', customer)

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

    /** submit 前: 店舗不一致の variant を含む明細があれば確認ダイアログを出す */
    const onSubmitWithStoreCheck = async (formValues: EstimateFormData) => {
        const customerStoreId = customer?.storeId ? String(customer.storeId) : ''
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
                `以下の明細は店舗変更により現在の顧客では利用できない種類が紐付いています:\n\n・${mismatches.join('\n・')}\n\n種類を選び直すことを推奨します。このまま登録してよろしいですか？`
            )
            if (!ok) return
        }
        return onSubmit(formValues)
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

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={handleSubmit(onSubmitWithStoreCheck, onInvalid)}
                className="flex flex-col px-10 py-8 pb-28"
                style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}
            >
                {/* ページヘッダー */}
                <div
                    className="flex items-end justify-between mb-6 pb-5"
                    style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                    <div>
                        <p
                            className="font-garamond mb-2"
                            style={{
                                fontSize: '12px',
                                color: 'var(--brand-gold-soft)',
                                letterSpacing: '0.3em',
                                fontWeight: 500,
                            }}
                        >
                            ESTIMATE · NEW
                        </p>
                        <h1
                            className="font-mincho"
                            style={{
                                fontSize: '26px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.2em',
                                lineHeight: 1.2,
                            }}
                        >
                            見積書 作成
                        </h1>
                    </div>
                </div>

                {/* 顧客情報サマリー */}
                <EstimateCustomerSummary customer={customer} />

                {/* タブ */}
                <div
                    className="flex"
                    style={{
                        borderBottom: '2px solid var(--brand-border)',
                        backgroundColor: '#fbfaf7',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setActiveTab('items')}
                        style={tabStyle(activeTab === 'items')}
                    >
                        明　細
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('other')}
                        style={tabStyle(activeTab === 'other')}
                    >
                        その他
                    </button>
                </div>

                {/* タブコンテンツコンテナ */}
                <div
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--brand-border)',
                        borderTop: 'none',
                        padding: '28px 32px',
                    }}
                >
                    {/* 明細タブ */}
                    {activeTab === 'items' && (
                        <>
                            <EstimateBasicInfo control={control} isNew />
                            {(errors.items?.root?.message ?? (errors.items as any)?.message) && (
                                <p
                                    className="mb-4 font-mincho"
                                    style={{
                                        marginTop: '-8px',
                                        fontSize: '14px',
                                        color: 'var(--brand-red)',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    {errors.items?.root?.message ?? (errors.items as any)?.message}
                                </p>
                            )}

                            {/* 明細入力モード切替 */}
                            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-1">
                                    <span
                                        className="font-garamond mr-3"
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-gold-soft)',
                                            letterSpacing: '0.3em',
                                        }}
                                    >
                                        MODE
                                    </span>
                                    {(
                                        [
                                            { value: 'list', label: '一覧から登録' },
                                            { value: 'card', label: 'カード型で順番に選択' },
                                        ] as const
                                    ).map((opt) => {
                                        const active = itemsViewMode === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setItemsViewMode(opt.value)}
                                                className="font-mincho transition-colors"
                                                style={{
                                                    padding: '8px 20px',
                                                    fontSize: '13px',
                                                    fontWeight: active ? 600 : 500,
                                                    letterSpacing: '0.15em',
                                                    backgroundColor: active
                                                        ? 'var(--brand-navy)'
                                                        : '#ffffff',
                                                    color: active ? '#ffffff' : 'var(--brand-text-muted)',
                                                    border: active
                                                        ? '1px solid var(--brand-navy)'
                                                        : '1px solid var(--brand-border)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {itemsViewMode === 'list' ? (
                                <EstimateItemTable
                                    items={items}
                                    fields={itemFields}
                                    control={control}
                                    isMember={watchedIsMember === 'true'}
                                    freeItems={freeItems}
                                    freeFields={freeItemFields}
                                    onVariantChange={handleVariantChange}
                                    onMultiSelectChange={handleMultiSelectChange}
                                    setValue={setValue}
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
                                    setValue={setValue}
                                    freeItems={freeItems}
                                    freeFields={freeItemFields}
                                    currentStoreId={customer?.storeId ? String(customer.storeId) : null}
                                />
                            )}
                        </>
                    )}

                    {/* その他タブ */}
                    {activeTab === 'other' && <EstimateOtherFields control={control} />}
                </div>

                {/* 操作ボタン（画面下部固定、合計と一緒に） */}
                <div
                    className="fixed bottom-0 left-0 right-0 flex items-center justify-between gap-6 px-10 py-3"
                    style={{
                        backgroundColor: '#ffffff',
                        borderTop: '1px solid var(--brand-border)',
                        boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                        zIndex: 40,
                    }}
                >
                    {/* 合計表示（左側） - カード型では右サイドバーに表示されるため非表示 */}
                    {itemsViewMode === 'list' ? (
                        <div
                            className="flex items-center gap-x-8 flex-wrap"
                            style={{
                                fontFamily: 'var(--font-mincho)',
                                color: 'var(--brand-text)',
                            }}
                        >
                            {[
                                { label: '小　計', value: totals.subtotal, sign: '¥' },
                                { label: '消費税', value: totals.tax, sign: '¥' },
                                { label: '合　計', value: totals.total, sign: '¥' },
                                {
                                    label: '会費入金',
                                    value: totals.membershipPaidAmount,
                                    sign: totals.membershipPaidAmount > 0 ? '−¥' : '¥',
                                },
                            ].map((t) => (
                                <div key={t.label} className="flex items-baseline gap-2">
                                    <span
                                        style={{
                                            fontSize: '12px',
                                            color: 'var(--brand-text-muted)',
                                            letterSpacing: '0.15em',
                                        }}
                                    >
                                        {t.label}
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                            fontSize: '16px',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {t.sign}
                                        {t.value.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            <div
                                className="flex items-baseline gap-2 pl-4"
                                style={{ borderLeft: '1px solid var(--brand-border)' }}
                            >
                                <span
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
                                    style={{
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                        fontSize: '24px',
                                        fontWeight: 600,
                                        color: 'var(--brand-navy)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    ¥{totals.grandTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div />
                    )}

                </div>

                {/* 操作ボタン（画面下固定: 登録=左、閉じる=右） */}
                <div className="fixed bottom-0 left-0 right-0 p-2 bg-white">
                    <div className="flex justify-between gap-3">
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
                        <button
                            type="button"
                            onClick={() => {
                                router.push('/cases')
                                router.refresh()
                            }}
                            className="font-mincho transition-colors"
                            style={{
                                padding: '12px 36px',
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
                    </div>
                </div>
            </form>
        </FormProvider>
    )
}

export default function EstimateNewPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="p-10"
                    style={{
                        fontFamily: 'var(--font-mincho)',
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.15em',
                    }}
                >
                    読み込み中…
                </div>
            }
        >
            <EstimateNewPageInner />
        </Suspense>
    )
}
