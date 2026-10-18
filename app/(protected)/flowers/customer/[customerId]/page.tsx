'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getBillingTargets, deleteFlower, Flower, FlowerBillingTarget } from '@/lib/flowers'
import { getCustomer } from '@/lib/customers'
import { createFlowerPayment, cancelFlowerPayment } from '@/lib/payments'
import { toast } from '@/hooks/use-toast'
import { extractValidationErrorMessage, handleOperationError } from '@/lib/errorHandler'
import { useDateFormat } from '@/hooks/useDateFormat'
import { FlowerCustomerInfo } from '../../components/FlowerCustomerInfo'
import { FlowerFormDialog } from '../../components/FlowerFormDialog'
import { BillingTargetDialog } from '../../components/BillingTargetDialog'
import { DataTable } from '@/components/table/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { CaseNavBar } from '@/components/case/CaseNavBar'
import {
    calcFlowerTargetTotal,
    countFlowers,
    filterFlowerTargets,
    getFlowerTargetPaymentStatus,
    summarizeFlowerTargets,
    type FlowerPaymentFilter,
    type FlowerTargetPaymentStatus,
} from '@/lib/flowerTotals'

// 供花（明細）の入金状況での絞り込み（CUSTOMER INFO と請求先一覧の間に出す）
const PAYMENT_FILTER_OPTIONS: { value: FlowerPaymentFilter; label: string }[] = [
    { value: 'ALL', label: 'すべて' },
    { value: 'PAID', label: '入金済み' },
    { value: 'UNPAID', label: '未入金' },
]

const TARGET_STATUS_LABELS: Record<FlowerTargetPaymentStatus, string> = {
    PAID: '入金済',
    PARTIAL: '一部入金',
    UNPAID: '未入金',
}

// 入金状況の表示（入金済=金、一部入金=紺、未入金=赤）
function paymentBadgeStyle(status: FlowerTargetPaymentStatus): React.CSSProperties {
    const colors = {
        PAID: { border: 'var(--brand-gold)', text: 'var(--brand-gold-soft)', bg: 'rgba(196, 174, 106, 0.1)' },
        PARTIAL: { border: 'var(--brand-navy)', text: 'var(--brand-navy)', bg: 'rgba(1, 8, 62, 0.05)' },
        UNPAID: { border: 'var(--brand-red)', text: 'var(--brand-red)', bg: 'rgba(154, 31, 40, 0.08)' },
    }[status]
    return {
        letterSpacing: '0.15em',
        fontWeight: 500,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: colors.border,
        color: colors.text,
        backgroundColor: colors.bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
    }
}

type ActionVariant = 'navy' | 'gold' | 'alert' | 'done' | 'accent' | 'muted'

function actionButtonStyle(variant: ActionVariant, disabled = false): React.CSSProperties {
    const base: React.CSSProperties = {
        fontSize: '14px',
        letterSpacing: '0.15em',
        fontWeight: 500,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'transparent',
        padding: '8px 18px',
        transition: 'all 0.15s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mincho)',
    }
    if (disabled) {
        return {
            ...base,
            backgroundColor: '#f0eee8',
            color: '#c4bfb0',
            borderColor: '#e0dbcc',
            borderStyle: 'dashed',
            opacity: 0.7,
        }
    }
    const activeShadow = '0 2px 4px rgba(1, 8, 62, 0.12)'
    switch (variant) {
        case 'navy':
            return {
                ...base,
                backgroundColor: 'var(--brand-navy)',
                color: '#ffffff',
                boxShadow: activeShadow,
            }
        case 'gold':
            return {
                ...base,
                backgroundColor: 'var(--brand-gold)',
                color: 'var(--brand-navy-dark)',
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
        case 'done':
            return {
                ...base,
                backgroundColor: '#ffffff',
                color: 'var(--brand-navy)',
                borderColor: 'var(--brand-navy)',
                boxShadow: '0 1px 2px rgba(1, 8, 62, 0.08)',
            }
        case 'accent':
            return {
                ...base,
                backgroundColor: '#ffffff',
                color: 'var(--brand-gold-soft)',
                borderColor: 'var(--brand-gold)',
                boxShadow: '0 1px 2px rgba(196, 174, 106, 0.2)',
            }
        case 'muted':
            return {
                ...base,
                backgroundColor: '#ffffff',
                color: 'var(--brand-text-muted)',
                borderColor: 'var(--brand-border)',
            }
        default:
            return base
    }
}

export default function FlowersListPage() {
    const router = useRouter()
    const params = useParams()
    const customerId = params.customerId as string
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [targets, setTargets] = useState<FlowerBillingTarget[]>([])
    const [dialogState, setDialogState] = useState<{
        open: boolean
        flower: Flower | null
        initialBillingTargetId?: string
    }>({
        open: false,
        flower: null,
    })
    const [targetDialogState, setTargetDialogState] = useState<{ open: boolean; target: FlowerBillingTarget | null }>({
        open: false,
        target: null,
    })
    const [paymentFilter, setPaymentFilter] = useState<FlowerPaymentFilter>('ALL')
    const [payingFlowerId, setPayingFlowerId] = useState<string | null>(null)
    const formatDate = useDateFormat()

    const loadData = useCallback(async () => {
        try {
            const [customerData, flowersData] = await Promise.all([
                getCustomer(customerId),
                getBillingTargets(customerId),
            ])
            setCustomer(customerData)
            setTargets(flowersData)
        } catch (error) {
            console.error('Failed to load data:', error)
            toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setLoading(false)
        }
    }, [customerId])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleDeleteFlower = async (id: string) => {
        if (!confirm('削除してもよろしいですか？')) return
        try {
            await deleteFlower(id)
            toast({ title: '削除しました', variant: 'success', duration: 2000 })
            loadData()
        } catch (error) {
            console.error('Failed to delete flower:', error)
            toast({ title: '削除に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    // 入金は供花1件ごと（請求先単位のまとめて入金は廃止）
    const handlePayment = async (flower: Flower) => {
        if (payingFlowerId) return
        setPayingFlowerId(flower.id)
        try {
            if (flower.isPaid) {
                await cancelFlowerPayment(flower.id)
                toast({ title: '入金を取り消しました', variant: 'success', duration: 2000 })
            } else {
                await createFlowerPayment(flower.id)
                toast({ title: '入金完了にしました', variant: 'success', duration: 2000 })
            }
            await loadData()
        } catch (error) {
            handleOperationError(error, extractValidationErrorMessage(error) ?? '入金処理に失敗しました')
        } finally {
            setPayingFlowerId(null)
        }
    }

    // 合計は絞り込みに関係なく案件全体で出す
    const totals = summarizeFlowerTargets(targets)
    // 絞り込みは供花（明細）単位。請求先の合計・入金状況は絞り込み前の全供花で出す
    const visibleTargets = filterFlowerTargets(targets, paymentFilter)
    const fullTargetById = new Map(targets.map((t) => [t.id, t]))

    if (loading) {
        return (
            <div
                className="p-10"
                style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}
            >
                読み込み中…
            </div>
        )
    }

    return (
        <div className="px-10 py-8" style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}>
            {/* 案件内の画面切替。一覧に戻らずに案件情報・見積・請求書へ移れる */}
            <CaseNavBar customerId={customerId} current="flowers" />

            {/* ページヘッダー */}
            <PageHeader
                title="供花一覧"
                actions={
                    <>
                        <button
                            onClick={() => window.open(`/api/pdf/flower-invoice/${customerId}`, '_blank')}
                            style={{
                                ...actionButtonStyle('accent'),
                                padding: '10px 22px',
                                fontSize: '15px',
                            }}
                        >
                            請求書一括印刷
                        </button>
                        <button
                            onClick={() => window.open(`/api/pdf/flower/${customerId}`, '_blank')}
                            style={{
                                ...actionButtonStyle('gold'),
                                padding: '10px 22px',
                                fontSize: '15px',
                            }}
                        >
                            領収書一括印刷
                        </button>
                        <button
                            onClick={() => setDialogState({ open: true, flower: null })}
                            style={{
                                ...actionButtonStyle('navy'),
                                padding: '10px 22px',
                                fontSize: '15px',
                            }}
                        >
                            ＋ 供花 新規登録
                        </button>
                    </>
                }
            />

            {/* 顧客情報サマリー */}
            {customer && <FlowerCustomerInfo customer={customer} totals={totals} />}

            {/* 入金状況での絞り込み（案件一覧のクイックフィルターと同じ見た目） */}
            {targets.length > 0 && (
                <div className="mb-4 flex items-center justify-end gap-3">
                    <span
                        className="font-mincho"
                        style={{
                            fontSize: '12px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.15em',
                            marginRight: '4px',
                        }}
                    >
                        絞り込み
                    </span>
                    {PAYMENT_FILTER_OPTIONS.map(({ value, label }) => {
                        const active = paymentFilter === value
                        return (
                            <button
                                key={value}
                                onClick={() => setPaymentFilter(value)}
                                className="px-6 py-2 transition-colors font-mincho"
                                style={{
                                    fontSize: '15px',
                                    letterSpacing: '0.15em',
                                    fontWeight: 500,
                                    border: active ? '1px solid var(--brand-navy)' : '1px solid var(--brand-navy-light)',
                                    backgroundColor: active ? 'var(--brand-navy)' : '#ffffff',
                                    color: active ? '#ffffff' : 'var(--brand-navy)',
                                }}
                            >
                                {label}（{countFlowers(targets, value)}）
                            </button>
                        )
                    })}
                </div>
            )}

            {/* 供花一覧（請求先単位） */}
            {targets.length > 0 && visibleTargets.length === 0 ? (
                <p
                    className="font-mincho"
                    style={{
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.15em',
                        padding: '32px 0',
                        textAlign: 'center',
                    }}
                >
                    {paymentFilter === 'PAID' ? '入金済みの供花はありません' : '未入金の供花はありません'}
                </p>
            ) : targets.length === 0 ? (
                <p
                    className="font-mincho"
                    style={{
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.15em',
                        padding: '32px 0',
                        textAlign: 'center',
                    }}
                >
                    請求先が登録されていません
                </p>
            ) : (
                visibleTargets.map((target) => {
                    const fullTarget = fullTargetById.get(target.id) ?? target
                    // 画面の金額は明細に合わせて税抜で統一する（税込は請求書・領収書PDFで出す）
                    const { subtotal } = calcFlowerTargetTotal(fullTarget)
                    const targetStatus = getFlowerTargetPaymentStatus(fullTarget)
                    return (
                        <div
                            key={target.id}
                            className="mb-8"
                            style={{
                                border: '1px solid var(--brand-border)',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 1px 2px rgba(1, 8, 62, 0.04)',
                            }}
                        >
                            {/* 請求先ヘッダー */}
                            <div
                                className="flex items-center justify-between"
                                style={{
                                    padding: '20px 28px',
                                    backgroundColor: 'var(--brand-ivory-light)',
                                    borderBottom: '1px solid var(--brand-border)',
                                }}
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <p
                                            className="font-mincho"
                                            style={{
                                                fontSize: '12px',
                                                color: 'var(--brand-gold-soft)',
                                                letterSpacing: '0.15em',
                                                fontWeight: 500,
                                            }}
                                        >
                                            請求先
                                        </p>
                                        <button
                                            onClick={() => setTargetDialogState({ open: true, target })}
                                            className="cursor-pointer"
                                            style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--brand-text-muted)',
                                                padding: 0,
                                                lineHeight: 1,
                                            }}
                                            title="請求先を編集"
                                            aria-label="請求先を編集"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                                edit
                                            </span>
                                        </button>
                                    </div>
                                    <h3
                                        className="font-mincho mb-1"
                                        style={{
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: 'var(--brand-navy)',
                                            letterSpacing: '0.15em',
                                        }}
                                    >
                                        {target.billToName}
                                    </h3>
                                    <div
                                        className="font-mincho"
                                        style={{
                                            fontSize: '13px',
                                            color: 'var(--brand-text-muted)',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        <p>{target.billToAddress}</p>
                                        {target.billToTel && <p>電話：{target.billToTel}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                    {fullTarget.flowers.length > 0 && (
                                        <div className="text-right">
                                            <p
                                                className="font-mincho"
                                                style={{
                                                    fontSize: '12px',
                                                    color: 'var(--brand-gold-soft)',
                                                    letterSpacing: '0.15em',
                                                    marginBottom: '2px',
                                                }}
                                            >
                                                合計（税抜）
                                            </p>
                                            <p
                                                className="font-mincho"
                                                style={{
                                                    fontSize: '22px',
                                                    fontWeight: 600,
                                                    color: 'var(--brand-navy)',
                                                    letterSpacing: '0.05em',
                                                }}
                                            >
                                                ¥{subtotal.toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() =>
                                                setDialogState({
                                                    open: true,
                                                    flower: null,
                                                    initialBillingTargetId: target.id,
                                                })
                                            }
                                            style={{
                                                ...actionButtonStyle('navy'),
                                                gap: '4px',
                                            }}
                                        >
                                            <span
                                                className="material-symbols-outlined"
                                                style={{ fontSize: '18px', lineHeight: 1 }}
                                                aria-hidden
                                            >
                                                add
                                            </span>
                                            この請求先で追加
                                        </button>
                                        {/* 入金は明細ごと。ここでは請求先全体の状況だけを表示する */}
                                        {fullTarget.flowers.length > 0 && (
                                            <span
                                                className="font-mincho"
                                                style={{ ...paymentBadgeStyle(targetStatus), padding: '8px 18px', fontSize: '14px' }}
                                            >
                                                {TARGET_STATUS_LABELS[targetStatus]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 供花明細テーブル */}
                            <div style={{ padding: '8px 16px 16px' }}>
                                <DataTable<Flower>
                                    // 依頼主・名札・連名は幅を指定せず、金額・入金・操作を除いた残りを三等分する
                                    fixedLayout
                                    columns={[
                                        { key: 'requesterName', label: '依頼主' },
                                        {
                                            key: 'labelName',
                                            label: '名札',
                                            render: (f) => f.labelName || '-',
                                        },
                                        {
                                            key: 'jointNames',
                                            label: '連名',
                                            render: (f) => f.jointNames || '-',
                                        },
                                        {
                                            key: 'amount',
                                            label: '金額',
                                            // ¥9,999,999（百万円の単位）まで1行に収まる幅
                                            width: '140px',
                                            render: (f) => `¥${f.amount.toLocaleString()}`,
                                        },
                                        {
                                            key: 'isPaid',
                                            label: '入金',
                                            width: '150px',
                                            render: (f) => (
                                                <div className="flex flex-col items-start gap-1">
                                                    <span
                                                        className="font-mincho"
                                                        style={{
                                                            ...paymentBadgeStyle(f.isPaid ? 'PAID' : 'UNPAID'),
                                                            padding: '4px 12px',
                                                            fontSize: '13px',
                                                        }}
                                                    >
                                                        {f.isPaid ? '入金済' : '未入金'}
                                                    </span>
                                                    {f.isPaid && f.paidAt && (
                                                        <span style={{ fontSize: '12px', color: 'var(--brand-text-muted)' }}>
                                                            {formatDate(f.paidAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            ),
                                        },
                                    ]}
                                    actionColumn={{
                                        key: 'actions',
                                        label: '操作',
                                        width: '300px',
                                        render: (flower) => (
                                            <div className="flex justify-center gap-2 [&>button]:whitespace-nowrap [&>button]:!px-3">
                                                <button
                                                    onClick={() => handlePayment(flower)}
                                                    disabled={payingFlowerId !== null}
                                                    style={actionButtonStyle(
                                                        flower.isPaid ? 'alert' : 'gold',
                                                        payingFlowerId !== null
                                                    )}
                                                >
                                                    {flower.isPaid ? '入金取消' : '入金完了'}
                                                </button>
                                                {/* 入金済みの供花は、金額や請求先が入金・領収書と食い違わないよう編集・削除不可 */}
                                                <button
                                                    onClick={() =>
                                                        !flower.isPaid &&
                                                        setDialogState({ open: true, flower })
                                                    }
                                                    disabled={flower.isPaid}
                                                    style={actionButtonStyle('done', flower.isPaid)}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    onClick={() => !flower.isPaid && handleDeleteFlower(flower.id)}
                                                    disabled={flower.isPaid}
                                                    style={actionButtonStyle('alert', flower.isPaid)}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        ),
                                    }}
                                    data={target.flowers}
                                    itemsPerPage={50}
                                    emptyMessage="供花が登録されていません"
                                    rowKey={(f) => f.id}
                                />
                            </div>
                        </div>
                    )
                })
            )}

            {/* 供花 新規登録 / 編集ダイアログ */}
            <FlowerFormDialog
                open={dialogState.open}
                onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
                customerId={customerId}
                flower={dialogState.flower}
                billingTargets={targets}
                initialBillingTargetId={dialogState.initialBillingTargetId}
                onSuccess={loadData}
            />

            {/* 請求先 登録 / 編集ダイアログ */}
            <BillingTargetDialog
                open={targetDialogState.open}
                onOpenChange={(open) => setTargetDialogState((prev) => ({ ...prev, open }))}
                customerId={customerId}
                target={targetDialogState.target}
                onSuccess={loadData}
            />
        </div>
    )
}
