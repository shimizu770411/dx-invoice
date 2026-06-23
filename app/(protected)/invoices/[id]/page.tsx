'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { invoiceFormSchema, InvoiceFormData, DEFAULT_INVOICE_FORM_VALUES } from '../schemas/InvoiceFormSchema'
import { useInvoiceEdit, calculateInvoiceTotals } from '../hooks/useInvoiceForm'
import { InvoiceItemTable } from '../components/InvoiceItemTable'
import { InvoiceOtherFields } from '../components/InvoiceOtherFields'
import { InvoiceCustomerSummary } from '../components/InvoiceCustomerSummary'
import { InvoiceBasicInfo } from '../components/InvoiceBasicInfo'
import { ProductVariant } from '@/lib/products'
import { resolveUnitPriceMember } from '@/lib/itemPricing'
import { toast } from '@/hooks/use-toast'

export default function InvoiceEditPage() {
    const router = useRouter()
    const params = useParams()
    const invoiceId = params.id as string

    const methods = useForm<InvoiceFormData>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: DEFAULT_INVOICE_FORM_VALUES,
    })
    const {
        control,
        handleSubmit,
        reset,
        setValue,
        formState: { isSubmitting, isDirty, errors },
    } = methods

    const { fields: itemFields } = useFieldArray({ control, name: 'items' })

    const { fields: freeItemFields } = useFieldArray({ control, name: 'freeItems' })

    const { loading, customer, invoice, items, setItems, freeItems, onSubmit } = useInvoiceEdit(invoiceId, reset)
    const [activeTab, setActiveTab] = useState<'items' | 'other'>('items')
    const [showSelectedOptions, setShowSelectedOptions] = useState(false)
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

    // 会員/一般切替時に、各 item の unitPriceMember を再計算
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

    if (!customer || !invoice) {
        return null
    }

    const totals = calculateInvoiceTotals(
        items,
        watchedItems,
        watchedIsMember === 'true',
        customer,
        freeItems,
        watchedFreeItems
    )

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
                `以下の明細は店舗変更により現在の顧客では利用できない種類が紐付いています:\n\n・${mismatches.join('\n・')}\n\n種類を選び直すことを推奨します。このまま更新してよろしいですか？`
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
                            INVOICE · EDIT
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
                            請求書 編集
                            {invoice.docNo && (
                                <span
                                    style={{
                                        fontSize: '16px',
                                        color: 'var(--brand-text-muted)',
                                        fontWeight: 400,
                                        letterSpacing: '0.15em',
                                        marginLeft: '20px',
                                    }}
                                >
                                    — No. {invoice.docNo}
                                </span>
                            )}
                        </h1>
                    </div>
                </div>

                {/* 顧客情報サマリー */}
                <InvoiceCustomerSummary customer={customer} />

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

                {/* タブコンテンツ */}
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
                            <InvoiceBasicInfo control={control} />
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
                            <InvoiceItemTable
                                items={items}
                                fields={itemFields}
                                control={control}
                                isMember={watchedIsMember === 'true'}
                                freeItems={freeItems}
                                freeFields={freeItemFields}
                                onVariantChange={handleVariantChange}
                                setValue={setValue}
                                currentStoreId={customer?.storeId ? String(customer.storeId) : null}
                            />
                        </>
                    )}

                    {/* その他タブ */}
                    {activeTab === 'other' && <InvoiceOtherFields control={control} />}
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

                </div>

                {/* 操作ボタン（画面下固定: 更新=左、PDFプレビュー=中央、閉じる=右） */}
                <div className="fixed bottom-0 left-0 right-0 p-2 bg-white">
                    {isDirty && (
                        <div className="text-right pb-1">
                            <span
                                className="font-mincho"
                                style={{
                                    fontSize: '12px',
                                    color: 'var(--brand-red)',
                                    letterSpacing: '0.15em',
                                }}
                            >
                                ※ 未保存の変更があります
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center gap-3">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="font-mincho transition-colors text-white"
                            style={{
                                padding: '12px 44px',
                                backgroundColor: isSubmitting ? '#7a7a7a' : 'var(--brand-navy)',
                                border: 'none',
                                fontSize: '14px',
                                letterSpacing: '0.4em',
                                fontWeight: 500,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                            }}
                        >
                            {isSubmitting ? '保存中…' : '更　新'}
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 text-sm">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="showOptions-invoice"
                                        checked={showSelectedOptions}
                                        onChange={() => setShowSelectedOptions(true)}
                                    />
                                    選択オプション表示
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="showOptions-invoice"
                                        checked={!showSelectedOptions}
                                        onChange={() => setShowSelectedOptions(false)}
                                    />
                                    非表示
                                </label>
                            </div>
                            <button
                                type="button"
                                disabled={isDirty}
                                onClick={() =>
                                    window.open(
                                        `/api/pdf/invoice/${invoice.id}${!showSelectedOptions ? '?showOptions=false' : ''}`,
                                        '_blank'
                                    )
                                }
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '12px 28px',
                                    backgroundColor: isDirty ? '#ffffff' : '#ffffff',
                                    color: isDirty ? '#c4bfb0' : 'var(--brand-gold-soft)',
                                    border: isDirty
                                        ? '1px dashed var(--brand-border)'
                                        : '1px solid var(--brand-gold)',
                                    fontSize: '14px',
                                    letterSpacing: '0.25em',
                                    fontWeight: 500,
                                    cursor: isDirty ? 'not-allowed' : 'pointer',
                                    boxShadow: isDirty ? 'none' : '0 1px 2px rgba(196, 174, 106, 0.2)',
                                }}
                            >
                                PDFプレビュー
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                router.push('/cases')
                                router.refresh()
                            }}
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
            </form>
        </FormProvider>
    )
}
