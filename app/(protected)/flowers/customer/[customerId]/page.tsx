'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getBillingTargets, deleteFlower, Flower, FlowerBillingTarget } from '@/lib/flowers'
import { getCustomer } from '@/lib/customers'
import { createFlowerTargetPayment, cancelFlowerTargetPayment } from '@/lib/payments'
import { toast } from '@/hooks/use-toast'
import { FlowerCustomerInfo } from '../../components/FlowerCustomerInfo'
import { FlowerFormDialog } from '../../components/FlowerFormDialog'
import { BillingTargetDialog } from '../../components/BillingTargetDialog'
import { DataTable } from '@/components/table/DataTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { CaseNavBar } from '@/components/case/CaseNavBar'

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

    const handlePayment = async (targetId: string, isPaid: boolean) => {
        try {
            if (isPaid) {
                await cancelFlowerTargetPayment(targetId)
                toast({ title: '入金を取り消しました', variant: 'success', duration: 2000 })
            } else {
                await createFlowerTargetPayment(targetId)
                toast({ title: '入金完了にしました', variant: 'success', duration: 2000 })
            }
            loadData()
        } catch (error) {
            console.error('Failed to update payment:', error)
            toast({ title: '入金処理に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    const getTargetTotal = (target: FlowerBillingTarget) => {
        return target.flowers.reduce((sum, f) => sum + f.amount, 0)
    }

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
                eyebrow="FLOWER LIST"
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
            {customer && <FlowerCustomerInfo customer={customer} />}

            {/* 供花一覧（請求先単位） */}
            {targets.length === 0 ? (
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
                targets.map((target) => {
                    const total = getTargetTotal(target)
                    const tax = Math.round(total * 0.1)
                    const totalWithTax = total + tax
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
                                            className="font-garamond"
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--brand-gold-soft)',
                                                letterSpacing: '0.3em',
                                                fontWeight: 500,
                                            }}
                                        >
                                            BILL TO
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
                                        {target.billToTel && <p>TEL: {target.billToTel}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                    {target.flowers.length > 0 && (
                                        <div className="text-right">
                                            <p
                                                className="font-garamond"
                                                style={{
                                                    fontSize: '10px',
                                                    color: 'var(--brand-gold-soft)',
                                                    letterSpacing: '0.3em',
                                                    marginBottom: '2px',
                                                }}
                                            >
                                                TOTAL (TAX INCL.)
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
                                                ¥{totalWithTax.toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        {!target.isPaid && (
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
                                        )}
                                        {target.flowers.length > 0 && (
                                            <>
                                                {target.isPaid ? (
                                                    <button
                                                        onClick={() => handlePayment(target.id, true)}
                                                        style={actionButtonStyle('alert')}
                                                    >
                                                        入金取消
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePayment(target.id, false)}
                                                        style={actionButtonStyle('gold')}
                                                    >
                                                        入金完了
                                                    </button>
                                                )}
                                                <span
                                                    className="font-mincho"
                                                    style={{
                                                        padding: '8px 18px',
                                                        fontSize: '14px',
                                                        letterSpacing: '0.15em',
                                                        fontWeight: 500,
                                                        borderWidth: '1px',
                                                        borderStyle: 'solid',
                                                        borderColor: target.isPaid
                                                            ? 'var(--brand-gold)'
                                                            : 'var(--brand-red)',
                                                        color: target.isPaid
                                                            ? 'var(--brand-gold-soft)'
                                                            : 'var(--brand-red)',
                                                        backgroundColor: target.isPaid
                                                            ? 'rgba(196, 174, 106, 0.1)'
                                                            : 'rgba(154, 31, 40, 0.08)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    {target.isPaid ? '入金済' : '未入金'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 供花明細テーブル */}
                            <div style={{ padding: '8px 16px 16px' }}>
                                <DataTable<Flower>
                                    columns={[
                                        { key: 'requesterName', label: '依頼主', width: '150px' },
                                        {
                                            key: 'labelName',
                                            label: '名札',
                                            width: '150px',
                                            render: (f) => f.labelName || '-',
                                        },
                                        {
                                            key: 'jointNames',
                                            label: '連名',
                                            width: '150px',
                                            render: (f) => f.jointNames || '-',
                                        },
                                        {
                                            key: 'amount',
                                            label: '金額',
                                            render: (f) => `¥${f.amount.toLocaleString()}`,
                                        },
                                    ]}
                                    actionColumn={{
                                        key: 'actions',
                                        label: '操作',
                                        width: '160px',
                                        render: (flower) => (
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() =>
                                                        !target.isPaid &&
                                                        setDialogState({ open: true, flower })
                                                    }
                                                    disabled={target.isPaid}
                                                    style={actionButtonStyle('done', target.isPaid)}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    onClick={() => !target.isPaid && handleDeleteFlower(flower.id)}
                                                    disabled={target.isPaid}
                                                    style={actionButtonStyle('alert', target.isPaid)}
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
