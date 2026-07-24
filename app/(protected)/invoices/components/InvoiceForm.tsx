'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceFormSchema, InvoiceFormData, DEFAULT_INVOICE_FORM_VALUES } from '../schemas/InvoiceFormSchema'
import { useInvoiceEdit, calculateInvoiceTotals } from '../hooks/useInvoiceForm'
import { InvoiceItemTable } from './InvoiceItemTable'
import { InvoiceOtherFields } from './InvoiceOtherFields'
import { InvoiceCustomerSummary } from './InvoiceCustomerSummary'
import { InvoiceBasicInfo } from './InvoiceBasicInfo'
import { InvoiceConfirmButtons } from './InvoiceConfirmButtons'
import { ProductVariant } from '@/lib/products'
import { resolveUnitPriceMember } from '@/lib/itemPricing'
import { toast } from '@/hooks/use-toast'
import type { InvoiceConfirmationFields } from '@/lib/invoices'

interface Invoice extends InvoiceConfirmationFields {
    id: string
    docNo?: string | null
    isPaid?: boolean
}

interface ContentProps {
    customer: any
    invoice?: Invoice
    setInvoice: React.Dispatch<React.SetStateAction<any>>
    items: any[]
    setItems: React.Dispatch<React.SetStateAction<any[]>>
    freeItems: any[]
    onSubmit: (data: InvoiceFormData) => Promise<void>
    methods: UseFormReturn<InvoiceFormData>
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

function InvoiceFormContent({
    customer, invoice, setInvoice,
    items, setItems, freeItems, onSubmit, methods,
}: ContentProps) {
    const router = useRouter()
    const {
        control,
        handleSubmit,
        setValue,
        formState: { isSubmitting, isDirty, errors },
    } = methods

    const { fields: itemFields } = useFieldArray({ control, name: 'items' })
    const { fields: freeItemFields } = useFieldArray({ control, name: 'freeItems' })

    const [activeTab, setActiveTab] = useState<'items' | 'other'>('items')
    const [showSelectedOptions, setShowSelectedOptions] = useState(false)

    // 入金済みの請求書は編集不可にする
    const isLocked = !!invoice?.isPaid

    const watchedItems = useWatch({ control, name: 'items' })
    const watchedFreeItems = useWatch({ control, name: 'freeItems' })
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
                    setValue(`items.${index}.description`, description)
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

    const totals = calculateInvoiceTotals(items, watchedItems, watchedIsMember === 'true', customer, freeItems, watchedFreeItems)

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

    const onSubmitWithStoreCheck = async (formValues: InvoiceFormData) => {
        const customerStoreId = customer?.storeId ? String(customer.storeId) : ''
        const actionLabel = '更新'
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
                            style={{ fontSize: '12px', color: 'var(--brand-gold-soft)', letterSpacing: '0.3em', fontWeight: 500 }}
                        >
                            INVOICE · EDIT
                        </p>
                        <h1
                            className="font-mincho"
                            style={{ fontSize: '26px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.2em', lineHeight: 1.2 }}
                        >
                            請求書 編集
                            {invoice?.docNo && (
                                <span style={{ fontSize: '16px', color: 'var(--brand-text-muted)', fontWeight: 400, letterSpacing: '0.15em', marginLeft: '20px' }}>
                                    — No. {invoice.docNo}
                                </span>
                            )}
                        </h1>
                    </div>
                    {invoice && (
                        <InvoiceConfirmButtons
                            invoiceId={invoice.id}
                            confirmations={invoice}
                            onConfirmed={(fields) => setInvoice((prev: any) => (prev ? { ...prev, ...fields } : prev))}
                        />
                    )}
                </div>

                <InvoiceCustomerSummary customer={customer} />

                {isLocked && (
                    <div className="mb-4 rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        入金済みのため、この請求書は閲覧のみです。
                    </div>
                )}

                {/* タブ */}
                <div className="flex" style={{ borderBottom: '2px solid var(--brand-border)', backgroundColor: '#fbfaf7' }}>
                    <button type="button" onClick={() => setActiveTab('items')} style={tabStyle(activeTab === 'items')}>明　細</button>
                    <button type="button" onClick={() => setActiveTab('other')} style={tabStyle(activeTab === 'other')}>その他</button>
                </div>

                {/* タブコンテンツ */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--brand-border)', borderTop: 'none', padding: '28px 32px' }}>
                    <fieldset disabled={isLocked} className="contents">
                    {activeTab === 'items' && (
                        <>
                            <InvoiceBasicInfo control={control} disabled={isLocked} />

                            {(errors.items?.root?.message ?? (errors.items as any)?.message) && (
                                <p
                                    className="mb-4 font-mincho"
                                    style={{ marginTop: '-8px', fontSize: '14px', color: 'var(--brand-red)', letterSpacing: '0.05em' }}
                                >
                                    {errors.items?.root?.message ?? (errors.items as any)?.message}
                                </p>
                            )}

                            <InvoiceItemTable
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
                        </>
                    )}
                    {activeTab === 'other' && <InvoiceOtherFields control={control} disabled={isLocked} customer={customer} />}
                    </fieldset>
                </div>

                {/* 操作ボタン & 合計（画面下部固定） */}
                <div
                    className="fixed bottom-0 left-0 right-0 flex items-center justify-between gap-6 px-10 py-3"
                    style={{
                        backgroundColor: '#ffffff',
                        borderTop: '1px solid var(--brand-border)',
                        boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                        zIndex: 40,
                    }}
                >
                    {/* 合計表示（左側） */}
                    <div
                        className="flex items-center gap-x-8 flex-wrap"
                        style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text)' }}
                    >
                        {[
                            { label: '小　計', value: totals.subtotal, sign: '¥' },
                            { label: '消費税', value: totals.tax, sign: '¥' },
                            { label: '合　計', value: totals.total, sign: '¥' },
                            { label: '会費入金', value: totals.membershipPaidAmount, sign: totals.membershipPaidAmount > 0 ? '−¥' : '¥' },
                        ].map((t) => (
                            <div key={t.label} className="flex items-baseline gap-2">
                                <span style={{ fontSize: '12px', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>{t.label}</span>
                                <span style={{ fontFamily: 'var(--font-garamond), var(--font-mincho)', fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                                    {t.sign}{t.value.toLocaleString()}
                                </span>
                            </div>
                        ))}
                        <div className="flex items-baseline gap-2 pl-4" style={{ borderLeft: '1px solid var(--brand-border)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--brand-navy)', letterSpacing: '0.25em', fontWeight: 600 }}>差引合計</span>
                            <span style={{ fontFamily: 'var(--font-garamond), var(--font-mincho)', fontSize: '24px', fontWeight: 600, color: 'var(--brand-navy)', fontVariantNumeric: 'tabular-nums' }}>
                                ¥{totals.grandTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* 右側ボタン群 */}
                    <div className="flex flex-col items-end gap-1">
                        {isDirty && (
                            <span className="font-mincho" style={{ fontSize: '12px', color: 'var(--brand-red)', letterSpacing: '0.15em' }}>
                                ※ 未保存の変更があります
                            </span>
                        )}
                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                disabled={isSubmitting || isLocked}
                                title={isLocked ? '入金済みのため更新できません' : undefined}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '12px 44px',
                                    backgroundColor: isSubmitting || isLocked ? '#7a7a7a' : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '14px',
                                    letterSpacing: '0.4em',
                                    fontWeight: 500,
                                    cursor: isSubmitting || isLocked ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                                }}
                            >
                                {isSubmitting ? '保存中…' : isLocked ? '更新不可（入金済み）' : '更　新'}
                            </button>
                            <div className="flex items-center gap-3 text-sm">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="showOptions-invoice" checked={showSelectedOptions} onChange={() => setShowSelectedOptions(true)} />
                                    選択オプション表示
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="showOptions-invoice" checked={!showSelectedOptions} onChange={() => setShowSelectedOptions(false)} />
                                    非表示
                                </label>
                            </div>
                            <button
                                type="button"
                                disabled={isDirty}
                                onClick={() => invoice && window.open(`/api/pdf/invoice/${invoice.id}${!showSelectedOptions ? '?showOptions=false' : ''}`, '_blank')}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '12px 28px',
                                    backgroundColor: '#ffffff',
                                    color: isDirty ? '#c4bfb0' : 'var(--brand-gold-soft)',
                                    border: isDirty ? '1px dashed var(--brand-border)' : '1px solid var(--brand-gold)',
                                    fontSize: '14px',
                                    letterSpacing: '0.25em',
                                    fontWeight: 500,
                                    cursor: isDirty ? 'not-allowed' : 'pointer',
                                    boxShadow: isDirty ? 'none' : '0 1px 2px rgba(196, 174, 106, 0.2)',
                                }}
                            >
                                PDFプレビュー
                            </button>
                            <button
                                type="button"
                                onClick={() => { router.push('/cases'); router.refresh() }}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '12px 28px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-text-muted)',
                                    border: '1px solid var(--brand-border)',
                                    fontSize: '14px',
                                    letterSpacing: '0.25em',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </FormProvider>
    )
}

export function InvoiceFormEdit({ invoiceId }: { invoiceId: string }) {
    const methods = useForm<InvoiceFormData>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: DEFAULT_INVOICE_FORM_VALUES,
    })
    const { loading, customer, invoice, setInvoice, items, setItems, freeItems, onSubmit } =
        useInvoiceEdit(invoiceId, methods.reset)

    if (loading || !customer || !invoice) return <LoadingState />

    return (
        <InvoiceFormContent
            customer={customer}
            invoice={invoice}
            setInvoice={setInvoice}
            items={items}
            setItems={setItems}
            freeItems={freeItems}
            onSubmit={onSubmit}
            methods={methods}
        />
    )
}
