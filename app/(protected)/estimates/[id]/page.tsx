'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, FormProvider, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { estimateFormSchema, EstimateFormData, DEFAULT_FORM_VALUES } from '../schemas/EstimateFormSchema'
import { useEstimateEdit, calculateTotals } from '../hooks/useEstimateForm'
import { EstimateItemTable } from '../components/EstimateItemTable'
import { EstimateItemWizard } from '../components/EstimateItemWizard'
import { EstimateTotals } from '../components/EstimateTotals'
import { EstimateOtherFields } from '../components/EstimateOtherFields'
import { EstimateCustomerSummary } from '../components/EstimateCustomerSummary'
import { EstimateBasicInfo } from '../components/EstimateBasicInfo'
import { ProductVariant } from '@/lib/products'
import { resolveUnitPriceMember } from '@/lib/itemPricing'
import { unconfirmEstimate } from '@/lib/estimates'
import { toast } from '@/hooks/use-toast'

export default function EstimateEditPage() {
    const router = useRouter()
    const params = useParams()
    const estimateId = params.id as string

    const methods = useForm<EstimateFormData>({
        resolver: zodResolver(estimateFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
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

    const { loading, customer, estimate, items, setItems, freeItems, onSubmit } = useEstimateEdit(estimateId, reset)
    const [activeTab, setActiveTab] = useState<'items' | 'other'>('items')
    const [itemsViewMode, setItemsViewMode] = useState<'list' | 'card'>('list')
    const [isConfirmedOnServer, setIsConfirmedOnServer] = useState(false)
    const watchedItems = useWatch({ control, name: 'items' })
    const watchedFreeItems = useWatch({ control, name: 'freeItems' })
    const watchedIsMember = useWatch({ control, name: 'isMember' })
    const watchedStatus = useWatch({ control, name: 'status' })

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

    const [showSelectedOptions, setShowSelectedOptions] = useState(false)

    useEffect(() => {
        if (estimate) {
            setIsConfirmedOnServer(estimate.status === 'CONFIRMED')
        }
    }, [estimate?.status])

    if (loading) {
        return <div className="p-8">読み込み中...</div>
    }

    if (!customer || !estimate) {
        return null
    }

    const isConfirmed = isConfirmedOnServer

    const totals = calculateTotals(
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
                `以下の明細は店舗変更により現在の顧客では利用できない種類が紐付いています:\n\n・${mismatches.join('\n・')}\n\n種類を選び直すことを推奨します。このまま更新してよろしいですか？`
            )
            if (!ok) return
        }
        return onSubmit(formValues)
    }

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmitWithStoreCheck, onInvalid)} className="flex flex-col p-8 pb-24">
                <h1 className="mb-8 text-2xl font-bold">見積書 編集</h1>

                {/* 顧客情報サマリー */}
                <EstimateCustomerSummary customer={customer} />

                {/* タブ */}
                <div className="mb-4 flex border-b-2 border-gray-300">
                    <button
                        type="button"
                        onClick={() => setActiveTab('items')}
                        className={`cursor-pointer border-none px-6 py-3 ${
                            activeTab === 'items'
                                ? 'border-b-2 border-blue-600 bg-blue-600 text-white'
                                : 'bg-transparent text-gray-700'
                        }`}
                    >
                        明細
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('other')}
                        className={`cursor-pointer border-none px-6 py-3 ${
                            activeTab === 'other'
                                ? 'border-b-2 border-blue-600 bg-blue-600 text-white'
                                : 'bg-transparent text-gray-700'
                        }`}
                    >
                        その他
                    </button>
                </div>

                <fieldset disabled={isConfirmed} className="contents">
                    {/* 明細タブ */}
                    {activeTab === 'items' && (
                        <>
                            <EstimateBasicInfo control={control} disabled={isConfirmed} />
                            {(errors.items?.root?.message ?? (errors.items as any)?.message) && (
                                <p className="-mt-4 mb-4 text-sm text-red-600">
                                    {errors.items?.root?.message ?? (errors.items as any)?.message}
                                </p>
                            )}
                            {/* 明細入力モード切替 */}
                            {!isConfirmed && (
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
                                                        color: active
                                                            ? '#ffffff'
                                                            : 'var(--brand-text-muted)',
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
                            )}

                            {itemsViewMode === 'list' || isConfirmed ? (
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
                                    readOnly={isConfirmed}
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
                            {(itemsViewMode === 'list' || isConfirmed) && <EstimateTotals totals={totals} />}
                        </>
                    )}

                    {/* その他タブ */}
                    {activeTab === 'other' && <EstimateOtherFields control={control} disabled={isConfirmed} />}
                </fieldset>

                {/* 操作ボタン（画面下固定: 更新=左、PDFプレビュー=中央、閉じる=右） */}
                <div className="fixed bottom-0 left-0 right-0 p-2">
                    {isDirty && <div className="text-red-600 text-right pb-1 text-sm">未保存の変更があります</div>}
                    <div className="flex justify-between items-center gap-4 bg-white">
                        <div className="flex gap-4">
                            {!isConfirmed && (
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`rounded border-0 px-6 py-3 text-white ${
                                        isSubmitting ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-green-600'
                                    }`}
                                >
                                    {isSubmitting ? '保存中...' : watchedStatus === 'CONFIRMED' ? '確定' : '更新'}
                                </button>
                            )}
                            {isConfirmed && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (
                                            !confirm(
                                                '本見積（確定）を解除して編集可能に戻します。\n客先と合意済みの見積を変更することになります。よろしいですか？'
                                            )
                                        )
                                            return
                                        try {
                                            await unconfirmEstimate(estimate.id)
                                            setIsConfirmedOnServer(false)
                                            setValue('status', 'DRAFT')
                                            toast({
                                                title: '確定を解除しました',
                                                variant: 'success',
                                                duration: 2000,
                                            })
                                            router.refresh()
                                        } catch (e: any) {
                                            toast({
                                                title: '確定解除に失敗しました',
                                                variant: 'destructive',
                                                duration: 3000,
                                            })
                                        }
                                    }}
                                    className="cursor-pointer rounded border-0 bg-orange-600 px-6 py-3 text-white"
                                    title="本見積を編集可能な状態（事前相談見積）に戻す"
                                >
                                    確定解除
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 text-sm">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="showOptions-estimate"
                                        checked={showSelectedOptions}
                                        onChange={() => setShowSelectedOptions(true)}
                                    />
                                    選択オプション表示
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="showOptions-estimate"
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
                                        `/api/pdf/estimate/${estimate.id}${!showSelectedOptions ? '?showOptions=false' : ''}`,
                                        '_blank'
                                    )
                                }
                                className={`rounded border-0 px-6 py-3 text-white ${
                                    isDirty ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-cyan-600'
                                }`}
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
                            className="cursor-pointer rounded border-0 bg-gray-500 px-6 py-3 text-white"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </form>
        </FormProvider>
    )
}
