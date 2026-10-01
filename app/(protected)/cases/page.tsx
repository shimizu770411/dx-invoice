'use client'

import { CreateButton } from '@/components/button/CreateButton'
import { DataTable } from '@/components/table/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { CustomerListItem, SearchCustomersParams } from '@/lib/customers'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomersQuery } from '@/hooks/useCustomer'
import { buildCaseSteps, CaseStepKey } from '@/lib/caseProgress'
import { caseStepButtonStyle } from '@/components/case/caseStepButtonStyle'
import { PaymentDialog } from '@/components/case/PaymentDialog'
import { createInvoiceFromEstimate } from '@/lib/invoices'
import { toast } from '@/hooks/use-toast'
import { handleOperationError } from '@/lib/errorHandler'
import { CaseSearchForm } from './components/CaseSearchForm'
import { useDateFormat } from '@/hooks/useDateFormat'

interface FormParams extends SearchCustomersParams {
    receptionFromInput?: string
    receptionToInput?: string
    funeralFromInput?: string
    funeralToInput?: string
}

// タブレット幅（lg未満）でのみ適用する操作ボタンの短縮ラベル。PC表示は元のラベルのまま
const CASE_ROW_LABEL_SHORT_MAP: Record<string, string> = {
    見積書作成: '見積書',
    事前相談見積: '事前見積',
    本見積編集: '本見積',
    請求書作成: '請求書',
    請求書編集: '請求書',
    '作成中…': '作成中',
    入金登録: '入金',
    入金取消: '取消',
    領収書発行: '領収書',
    供花登録: '供花',
}
const shortCaseRowLabel = (label: string) => CASE_ROW_LABEL_SHORT_MAP[label] ?? label

// タブレット幅では短縮ラベル、PC(lg以上)ではフルラベルを表示
function ResponsiveActionLabel({ label }: { label: string }) {
    return (
        <>
            <span className="lg:hidden">{shortCaseRowLabel(label)}</span>
            <span className="hidden lg:inline">{label}</span>
        </>
    )
}

// 操作ボタンのサイズ: タブレット幅ではコンパクトに、PC(lg以上)では現状のサイズを維持
const CASE_ROW_BTN_SIZE_CLASSES =
    'px-2.5 py-3 text-[13px] min-w-[80px] lg:px-[18px] lg:py-2 lg:text-sm lg:min-w-[110px]'

export default function CasesPage() {
    const router = useRouter()
    // フォーム入力値（検索後も保持）
    const [formParams, setFormParams] = useState<FormParams>({})
    // 実際に検索に使用するパラメータ
    const [searchParams, setSearchParams] = useState<SearchCustomersParams>({})
    const [activeQuickFilter, setActiveQuickFilter] = useState<'NONE' | 'DRAFT' | 'CONFIRMED' | null>(null)
    const [paymentDialog, setPaymentDialog] = useState<{
        open: boolean
        invoiceId: string | null
        customerId: string | null
        isPaid: boolean
    }>({ open: false, invoiceId: null, customerId: null, isPaid: false })

    const [creatingInvoiceForId, setCreatingInvoiceForId] = useState<string | null>(null)

    // React Query フック
    const queryClient = useQueryClient()
    const { data: customers = [], isLoading: customersLoading } = useCustomersQuery(searchParams)
    const formatDate = useDateFormat()

    const loading = customersLoading

    const handleSearch = (params: SearchCustomersParams) => {
        // searchParams を更新して検索を実行
        setSearchParams(params)
        setActiveQuickFilter(null)
        // formParams は既に更新されているので、ここでは何もしない
    }

    const handleReset = () => {
        // フォーム入力値と検索パラメータをリセット
        setFormParams({})
        setSearchParams({})
        setActiveQuickFilter(null)
    }

    const handleQuickFilter = (status: 'NONE' | 'DRAFT' | 'CONFIRMED') => {
        if (activeQuickFilter === status) {
            setActiveQuickFilter(null)
            setSearchParams({})
        } else {
            setActiveQuickFilter(status)
            if (status === 'NONE') {
                setSearchParams({ noEstimate: true })
            } else {
                setSearchParams({ estimateStatus: status })
            }
        }
    }

    const handlePaymentClick = (customer: CustomerListItem) => {
        if (!customer.invoiceId) return
        setPaymentDialog({
            open: true,
            invoiceId: customer.invoiceId,
            customerId: customer.id,
            isPaid: customer.isPaid,
        })
    }

    const handlePaymentCancel = () => {
        setPaymentDialog({ open: false, invoiceId: null, customerId: null, isPaid: false })
    }

    if (loading && customers.length === 0) {
        return (
            <div className="p-10" style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)' }}>
                読み込み中…
            </div>
        )
    }

    return (
        <div className="px-10 py-8" style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}>
            {/* ページヘッダー */}
            <PageHeader
                eyebrow="CASE LIST"
                title="葬儀案件一覧"
                actions={<CreateButton onClick={() => router.push('/cases/new')}>新規登録</CreateButton>}
            />

            {/* 検索条件エリア */}
            <CaseSearchForm
                formParams={formParams}
                setFormParams={setFormParams}
                onSearch={handleSearch}
                onReset={handleReset}
                isLoading={loading}
            />

            {/* クイックフィルター */}
            <div className="mb-4 flex items-center justify-end gap-3">
                <span
                    className="font-garamond"
                    style={{
                        fontSize: '11px',
                        color: 'var(--brand-gold-soft)',
                        letterSpacing: '0.3em',
                        marginRight: '4px',
                    }}
                >
                    FILTER
                </span>
                {activeQuickFilter && (
                    <button
                        onClick={() => handleQuickFilter(activeQuickFilter)}
                        className="flex items-center px-3 py-2 transition-colors"
                        style={{
                            border: '1px solid var(--brand-border)',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                        }}
                        title="フィルタ解除"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            filter_alt_off
                        </span>
                    </button>
                )}
                <button
                    onClick={() => handleQuickFilter('NONE')}
                    className="px-6 py-2 transition-colors font-mincho"
                    style={{
                        fontSize: '15px',
                        letterSpacing: '0.15em',
                        fontWeight: 500,
                        border:
                            activeQuickFilter === 'NONE'
                                ? '1px solid var(--brand-text)'
                                : '1px dashed var(--brand-border)',
                        backgroundColor: activeQuickFilter === 'NONE' ? 'var(--brand-text)' : '#ffffff',
                        color: activeQuickFilter === 'NONE' ? '#ffffff' : 'var(--brand-text-muted)',
                    }}
                >
                    未作成
                </button>
                <button
                    onClick={() => handleQuickFilter('DRAFT')}
                    className="px-6 py-2 transition-colors font-mincho"
                    style={{
                        fontSize: '15px',
                        letterSpacing: '0.15em',
                        fontWeight: 500,
                        border:
                            activeQuickFilter === 'DRAFT'
                                ? '1px solid var(--brand-navy)'
                                : '1px solid var(--brand-navy-light)',
                        backgroundColor: activeQuickFilter === 'DRAFT' ? 'var(--brand-navy)' : '#ffffff',
                        color: activeQuickFilter === 'DRAFT' ? '#ffffff' : 'var(--brand-navy)',
                    }}
                >
                    事前相談見積
                </button>
                <button
                    onClick={() => handleQuickFilter('CONFIRMED')}
                    className="px-6 py-2 transition-colors font-mincho"
                    style={{
                        fontSize: '15px',
                        letterSpacing: '0.15em',
                        fontWeight: 500,
                        border:
                            activeQuickFilter === 'CONFIRMED'
                                ? '1px solid var(--brand-gold)'
                                : '1px solid var(--brand-gold-light)',
                        backgroundColor: activeQuickFilter === 'CONFIRMED' ? 'var(--brand-gold)' : '#ffffff',
                        color: activeQuickFilter === 'CONFIRMED' ? 'var(--brand-navy-dark)' : 'var(--brand-gold-soft)',
                    }}
                >
                    本見積
                </button>
            </div>

            {/* 検索結果一覧 */}
            <div className="flex flex-col">
                <DataTable<CustomerListItem>
                    columns={[
                        {
                            key: 'receptionNo',
                            label: 'No',
                            width: '50px',
                        },
                        {
                            key: 'receptionAt',
                            label: '受付日',
                            width: '120px',
                            sortable: true,
                            sortValue: (item) => (item.receptionAt ? new Date(item.receptionAt).getTime() : null),
                            render: (item) => (
                                <span style={{ whiteSpace: 'nowrap' }}>{formatDate(item.receptionAt)}</span>
                            ),
                        },
                        {
                            key: 'deceasedName',
                            label: '故人名',
                            width: '120px',
                        },
                        {
                            key: 'chiefMournerName',
                            label: '喪主名',
                            width: '120px',
                        },
                    ]}
                    subRow={(item) => {

                        const LockIcon = () => (
                            <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '16px', opacity: 0.8 }}
                                aria-hidden
                            >
                                lock
                            </span>
                        )

                        // ステップの状態（ラベル・配色・使えるかどうか）は、この一覧と各画面上部の切替バーで共通にしている。
                        // 片方だけ条件を変えると、同じ案件なのに画面によって押せるボタンが違う、という食い違いが起きる
                        const steps = buildCaseSteps(item)
                        const stepOf = (key: CaseStepKey) => steps.find((s) => s.key === key)!
                        const estStep = stepOf('estimate')
                        const invStep = stepOf('invoice')
                        const payStep = stepOf('payment')
                        const recStep = stepOf('receipt')
                        // 事前相談見積の別枠ボタンは、本見積を作ったあとだけ並ぶ
                        const preConsultStep = steps.find((s) => s.key === 'preConsultEstimate')

                        const isCreatingInvoice = creatingInvoiceForId === item.id
                        const invLabel = isCreatingInvoice ? '作成中…' : invStep.label

                        // フロー矢印
                        const Arrow = () => (
                            <span
                                className="flex items-center px-0 text-[13px] lg:px-0.5 lg:text-base"
                                style={{
                                    color: 'var(--brand-gold-soft)',
                                    userSelect: 'none',
                                }}
                            >
                                ›
                            </span>
                        )

                        return (
                            <div
                                className="flex items-center gap-0.5 flex-wrap lg:gap-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* 葬儀案件の編集（会員情報・故人情報など） */}
                                <button
                                    onClick={() => router.push(`/cases/${item.id}`)}
                                    style={caseStepButtonStyle('accent')}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title="案件詳細・会員情報を編集"
                                >
                                    {stepOf('case').label}
                                </button>
                                <span
                                    className="mx-1.5 self-stretch lg:mx-2"
                                    style={{
                                        width: '1px',
                                        backgroundColor: 'var(--brand-border)',
                                    }}
                                />
                                {/* メインフロー: 見積 → 請求 → 入金 → 領収書 */}
                                {/* 本見積あり: 事前相談見積（左）→ 本見積編集（右）の時系列順 */}
                                {preConsultStep && item.preConsultEstimateId && (
                                    <button
                                        onClick={() => router.push(`/estimates/${item.preConsultEstimateId}`)}
                                        style={caseStepButtonStyle(preConsultStep.variant)}
                                        className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                        title="事前相談見積を閲覧"
                                    >
                                        <ResponsiveActionLabel label="事前相談見積" />
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (item.hasEstimate) router.push(`/estimates/${item.estimateId}`)
                                        else router.push(`/estimates/new?customerId=${item.id}`)
                                    }}
                                    style={caseStepButtonStyle(estStep.variant)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                >
                                    <ResponsiveActionLabel label={estStep.label} />
                                </button>
                                <Arrow />
                                <button
                                    onClick={async () => {
                                        if (invStep.disabled || isCreatingInvoice) return
                                        if (item.hasInvoice && item.invoiceId) {
                                            router.push(`/invoices/${item.invoiceId}`)
                                            return
                                        }
                                        if (
                                            !confirm(
                                                '請求書を作成します。\n請求書を作成すると見積書が変更不可となります。\nよろしいですか？'
                                            )
                                        )
                                            return
                                        setCreatingInvoiceForId(item.id)
                                        try {
                                            const newInvoice = await createInvoiceFromEstimate(
                                                item.id,
                                                item.estimateId!
                                            )
                                            toast({ title: '請求書を作成しました', variant: 'success', duration: 2000 })
                                            queryClient.invalidateQueries({ queryKey: ['customers'] })
                                            router.push(`/invoices/${newInvoice.id}`)
                                        } catch (error) {
                                            handleOperationError(error, '請求書の作成に失敗しました')
                                        } finally {
                                            setCreatingInvoiceForId(null)
                                        }
                                    }}
                                    disabled={invStep.disabled || isCreatingInvoice}
                                    style={caseStepButtonStyle(invStep.variant, invStep.disabled || isCreatingInvoice)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={invStep.lockedReason}
                                >
                                    {invStep.disabled && <LockIcon />}
                                    <ResponsiveActionLabel label={invLabel} />
                                </button>
                                <Arrow />
                                <button
                                    onClick={() => {
                                        if (payStep.disabled) return
                                        handlePaymentClick(item)
                                    }}
                                    disabled={payStep.disabled}
                                    style={caseStepButtonStyle(payStep.variant, payStep.disabled)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={payStep.lockedReason}
                                >
                                    {payStep.disabled && <LockIcon />}
                                    <ResponsiveActionLabel label={payStep.label} />
                                </button>
                                <Arrow />
                                <button
                                    onClick={() => {
                                        if (recStep.disabled || !item.invoiceId) return
                                        window.open(`/api/pdf/receipt/${item.invoiceId}?_t=${Date.now()}`, '_blank')
                                    }}
                                    disabled={recStep.disabled}
                                    style={caseStepButtonStyle(recStep.variant, recStep.disabled)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={recStep.lockedReason}
                                >
                                    {recStep.disabled && <LockIcon />}
                                    <ResponsiveActionLabel label="領収書発行" />
                                </button>

                                {/* 区切り */}
                                <span
                                    className="mx-2.5 self-stretch lg:mx-3"
                                    style={{
                                        width: '1px',
                                        backgroundColor: 'var(--brand-border)',
                                    }}
                                />

                                {/* 並列タスク */}
                                <button
                                    onClick={() => router.push(`/flowers/customer/${item.id}`)}
                                    style={caseStepButtonStyle('accent')}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                >
                                    <ResponsiveActionLabel label="供花登録" />
                                </button>
                            </div>
                        )
                    }}
                    data={customers}
                    itemsPerPage={10}
                    onRowClick={(customer) => router.push(`/cases/${customer.id}`)}
                    emptyMessage="検索結果がありません"
                    rowKey={(item) => item.id}
                    resetKey={searchParams}
                />
            </div>

            {/* 入金登録・取消のダイアログ。各画面上部の切替バーからも同じものを開く */}
            {paymentDialog.open && paymentDialog.invoiceId && (
                <PaymentDialog
                    invoiceId={paymentDialog.invoiceId}
                    isPaid={paymentDialog.isPaid}
                    onClose={handlePaymentCancel}
                />
            )}
        </div>
    )
}
