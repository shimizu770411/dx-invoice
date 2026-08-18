'use client'

import { CreateButton } from '@/components/button/CreateButton'
import { DataTable } from '@/components/table/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { CustomerListItem, SearchCustomersParams } from '@/lib/customers'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomersQuery } from '@/hooks/useCustomer'
import { useCreatePaymentMutation, useCancelPaymentMutation } from '@/hooks/usePayment'
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
    入金登録: '入金',
    領収書発行: '領収書',
    供花登録: '供花',
}
const shortCaseRowLabel = (label: string) => CASE_ROW_LABEL_SHORT_MAP[label] ?? label

// 操作ボタンのサイズ: タブレット幅ではコンパクトに、PC(lg以上)では現状のサイズを維持
const CASE_ROW_BTN_SIZE_CLASSES = 'px-2.5 py-3 text-[13px] min-w-[80px] lg:px-[18px] lg:py-2 lg:text-sm lg:min-w-[110px]'

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
    const [paymentData, setPaymentData] = useState({ paidAt: '', memo: '' })

    const [creatingInvoiceForId, setCreatingInvoiceForId] = useState<string | null>(null)

    // React Query フック
    const queryClient = useQueryClient()
    const { data: customers = [], isLoading: customersLoading } = useCustomersQuery(searchParams)
    const createPaymentMutation = useCreatePaymentMutation()
    const cancelPaymentMutation = useCancelPaymentMutation()
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
        setPaymentData({
            paidAt: new Date().toISOString().split('T')[0],
            memo: '',
        })
    }

    const handlePaymentSave = async () => {
        if (!paymentDialog.invoiceId) return
        try {
            if (paymentDialog.isPaid) {
                await cancelPaymentMutation.mutateAsync({
                    invoiceId: paymentDialog.invoiceId,
                    data: paymentData,
                })
            } else {
                await createPaymentMutation.mutateAsync({
                    invoiceId: paymentDialog.invoiceId,
                    data: paymentData,
                })
            }
            setPaymentDialog({ open: false, invoiceId: null, customerId: null, isPaid: false })
        } catch (error) {
            console.error('Payment failed:', error)
            alert('入金処理に失敗しました')
        }
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
                        backgroundColor:
                            activeQuickFilter === 'NONE' ? 'var(--brand-text)' : '#ffffff',
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
                        backgroundColor:
                            activeQuickFilter === 'DRAFT' ? 'var(--brand-navy)' : '#ffffff',
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
                        backgroundColor:
                            activeQuickFilter === 'CONFIRMED' ? 'var(--brand-gold)' : '#ffffff',
                        color:
                            activeQuickFilter === 'CONFIRMED' ? 'var(--brand-navy-dark)' : 'var(--brand-gold-soft)',
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
                            render: (item) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(item.receptionAt)}</span>,
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
                        type Variant = 'primary' | 'gold' | 'done' | 'current' | 'alert' | 'disabled' | 'accent'

                        const btnStyle = (variant: Variant, disabled = false): React.CSSProperties => {
                            const base: React.CSSProperties = {
                                letterSpacing: '0.12em',
                                fontWeight: 500,
                                border: '1px solid transparent',
                                transition: 'all 0.15s ease',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                            }
                            if (disabled) {
                                return {
                                    ...base,
                                    backgroundColor: '#f0eee8',
                                    color: '#c4bfb0',
                                    borderColor: '#e0dbcc',
                                    borderStyle: 'dashed',
                                    opacity: 0.7,
                                    boxShadow: 'none',
                                }
                            }
                            const activeShadow = '0 2px 4px rgba(1, 8, 62, 0.12)'
                            switch (variant) {
                                case 'primary':
                                    return {
                                        ...base,
                                        backgroundColor: 'var(--brand-navy)',
                                        color: '#fff',
                                        boxShadow: activeShadow,
                                    }
                                case 'gold':
                                    return {
                                        ...base,
                                        backgroundColor: 'var(--brand-gold)',
                                        color: 'var(--brand-navy-dark)',
                                        boxShadow: activeShadow,
                                    }
                                case 'done':
                                    return {
                                        ...base,
                                        backgroundColor: '#ffffff',
                                        color: 'var(--brand-navy)',
                                        borderColor: 'var(--brand-navy)',
                                        boxShadow: '0 1px 2px rgba(1, 8, 62, 0.08)',
                                    }
                                case 'current':
                                    return {
                                        ...base,
                                        backgroundColor: 'var(--brand-navy)',
                                        color: '#fff',
                                        boxShadow: activeShadow,
                                    }
                                case 'alert':
                                    return {
                                        ...base,
                                        backgroundColor: 'var(--brand-red)',
                                        color: '#ffffff',
                                        borderColor: 'var(--brand-red)',
                                        boxShadow: '0 2px 4px rgba(154, 31, 40, 0.25)',
                                    }
                                case 'accent':
                                    return {
                                        ...base,
                                        backgroundColor: '#ffffff',
                                        color: 'var(--brand-gold-soft)',
                                        borderColor: 'var(--brand-gold)',
                                        boxShadow: '0 1px 2px rgba(196, 174, 106, 0.2)',
                                    }
                                default:
                                    return base
                            }
                        }

                        const LockIcon = () => (
                            <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '16px', opacity: 0.8 }}
                                aria-hidden
                            >
                                lock
                            </span>
                        )

                        // ステップの状態判定
                        const hasEst = item.hasEstimate
                        const hasInv = item.hasInvoice
                        const isPaid = item.isPaid

                        // 見積書: 本見積あり → gold、事前相談見積のみ → done、未作成 → primary
                        const hasFormalEst = item.estimateType === 'FORMAL'
                        const estVariant: Variant = !hasEst
                            ? 'primary'
                            : hasFormalEst
                              ? 'gold'
                              : 'done'
                        const estLabel = !hasEst
                            ? '見積書作成'
                            : hasFormalEst
                              ? '本見積編集'
                              : '事前相談見積'

                        // 請求書: 本見積なし → disabled、請求書なし → primary(次ステップ)、あり → done
                        const invDisabled = !hasFormalEst
                        const invVariant: Variant = hasInv ? 'done' : 'primary'
                        const isCreatingInvoice = creatingInvoiceForId === item.id
                        const invLabel = isCreatingInvoice ? '作成中…' : hasInv ? '請求書編集' : '請求書作成'

                        // 入金: 請求書なし → disabled、未入金 → alert(要対応)、入金済 → done
                        const payDisabled = !hasInv
                        const payVariant: Variant = isPaid ? 'done' : 'alert'
                        const payLabel = isPaid ? '入金取消' : '入金登録'

                        // 領収書: 未入金 → disabled、入金済 → gold(最終成果物)
                        const recDisabled = !isPaid
                        const recVariant: Variant = 'gold'

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
                                {/* 案件編集（会員情報・故人情報など） */}
                                <button
                                    onClick={() => router.push(`/cases/${item.id}`)}
                                    style={btnStyle('accent')}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title="案件詳細・会員情報を編集"
                                >
                                    情報編集
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
                                {hasFormalEst && item.preConsultEstimateId && (
                                    <button
                                        onClick={() => router.push(`/estimates/${item.preConsultEstimateId}`)}
                                        style={btnStyle('done')}
                                        className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                        title="事前相談見積を閲覧"
                                    >
                                        <span className="lg:hidden">{shortCaseRowLabel('事前相談見積')}</span>
                                        <span className="hidden lg:inline">事前相談見積</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (hasEst) router.push(`/estimates/${item.estimateId}`)
                                        else router.push(`/estimates/new?customerId=${item.id}`)
                                    }}
                                    style={btnStyle(estVariant)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                >
                                    <span className="lg:hidden">{shortCaseRowLabel(estLabel)}</span>
                                    <span className="hidden lg:inline">{estLabel}</span>
                                </button>
                                <Arrow />
                                <button
                                    onClick={async () => {
                                        if (invDisabled || isCreatingInvoice) return
                                        if (hasInv && item.invoiceId) {
                                            router.push(`/invoices/${item.invoiceId}`)
                                            return
                                        }
                                        setCreatingInvoiceForId(item.id)
                                        try {
                                            const newInvoice = await createInvoiceFromEstimate(item.id, item.estimateId!)
                                            toast({ title: '請求書を作成しました', variant: 'success', duration: 2000 })
                                            queryClient.invalidateQueries({ queryKey: ['customers'] })
                                            router.push(`/invoices/${newInvoice.id}`)
                                        } catch (error) {
                                            handleOperationError(error, '請求書の作成に失敗しました')
                                        } finally {
                                            setCreatingInvoiceForId(null)
                                        }
                                    }}
                                    disabled={invDisabled || isCreatingInvoice}
                                    style={btnStyle(invVariant, invDisabled || isCreatingInvoice)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={invDisabled ? '本見積作成後に使用できます' : undefined}
                                >
                                    {invDisabled && <LockIcon />}
                                    <span className="lg:hidden">{shortCaseRowLabel(invLabel)}</span>
                                    <span className="hidden lg:inline">{invLabel}</span>
                                </button>
                                <Arrow />
                                <button
                                    onClick={() => {
                                        if (payDisabled) return
                                        handlePaymentClick(item)
                                    }}
                                    disabled={payDisabled}
                                    style={btnStyle(payVariant, payDisabled)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={payDisabled ? '請求書作成後に使用できます' : undefined}
                                >
                                    {payDisabled && <LockIcon />}
                                    <span className="lg:hidden">{shortCaseRowLabel(payLabel)}</span>
                                    <span className="hidden lg:inline">{payLabel}</span>
                                </button>
                                <Arrow />
                                <button
                                    onClick={() => {
                                        if (recDisabled || !item.invoiceId) return
                                        window.open(`/api/pdf/receipt/${item.invoiceId}?_t=${Date.now()}`, '_blank')
                                    }}
                                    disabled={recDisabled}
                                    style={btnStyle(recVariant, recDisabled)}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                    title={recDisabled ? '入金登録後に使用できます' : undefined}
                                >
                                    {recDisabled && <LockIcon />}
                                    <span className="lg:hidden">{shortCaseRowLabel('領収書発行')}</span>
                                    <span className="hidden lg:inline">領収書発行</span>
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
                                    style={btnStyle('accent')}
                                    className={`font-mincho ${CASE_ROW_BTN_SIZE_CLASSES}`}
                                >
                                    <span className="lg:hidden">{shortCaseRowLabel('供花登録')}</span>
                                    <span className="hidden lg:inline">供花登録</span>
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

            {/* 入金入力ダイアログ */}
            {paymentDialog.open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(1, 8, 62, 0.55)' }}
                    onClick={handlePaymentCancel}
                >
                    <div
                        className="w-11/12 max-w-md bg-white"
                        style={{
                            border: '1px solid var(--brand-border)',
                            borderTop: '4px solid var(--brand-navy)',
                            padding: '40px 36px',
                            boxShadow: '0 20px 40px rgba(1, 8, 62, 0.2)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-6 pb-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                            <p
                                className="font-garamond mb-2"
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--brand-gold-soft)',
                                    letterSpacing: '0.3em',
                                    fontWeight: 500,
                                }}
                            >
                                {paymentDialog.isPaid ? 'CANCEL PAYMENT' : 'REGISTER PAYMENT'}
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
                                {paymentDialog.isPaid ? '入金取消' : '入金登録'}
                            </h2>
                        </div>

                        <div className="mb-5">
                            <label
                                className="mb-2 block font-mincho"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: 'var(--brand-navy)',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                入金日
                            </label>
                            <input
                                type="date"
                                value={paymentData.paidAt}
                                onChange={(e) => setPaymentData({ ...paymentData, paidAt: e.target.value })}
                                className="w-full focus:outline-none transition-colors"
                                style={{
                                    padding: '12px 14px',
                                    fontSize: '16px',
                                    border: '1px solid var(--brand-input-border)',
                                    backgroundColor: 'var(--brand-ivory-light)',
                                }}
                            />
                        </div>

                        <div className="mb-8">
                            <label
                                className="mb-2 block font-mincho"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: 'var(--brand-navy)',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                備考
                            </label>
                            <textarea
                                value={paymentData.memo}
                                onChange={(e) => setPaymentData({ ...paymentData, memo: e.target.value })}
                                rows={3}
                                className="w-full focus:outline-none transition-colors"
                                style={{
                                    padding: '12px 14px',
                                    fontSize: '16px',
                                    border: '1px solid var(--brand-input-border)',
                                    backgroundColor: 'var(--brand-ivory-light)',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handlePaymentCancel}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '12px 32px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-text-muted)',
                                    border: '1px solid var(--brand-border)',
                                    fontSize: '15px',
                                    letterSpacing: '0.2em',
                                    fontWeight: 500,
                                }}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handlePaymentSave}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '12px 32px',
                                    backgroundColor: paymentDialog.isPaid
                                        ? 'var(--brand-red)'
                                        : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '15px',
                                    letterSpacing: '0.3em',
                                    fontWeight: 500,
                                }}
                            >
                                {paymentDialog.isPaid ? '取　消' : '保　存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
