'use client'

import { useState } from 'react'
import { useCreatePaymentMutation, useCancelPaymentMutation } from '@/hooks/usePayment'
import { handleOperationError } from '@/lib/errorHandler'

/**
 * 入金登録・入金取消のダイアログ。
 *
 * もともと案件一覧の中だけにあったが、各画面上部の切替バーからも入金を扱うため切り出した。
 * 一覧とバーで入力項目や取消の挙動が食い違わないよう、ここ1か所にまとめている。
 */
interface PaymentDialogProps {
    /** 対象の請求書。開くかどうかは呼び出し側で判断する */
    invoiceId: string
    /** 入金済みなら取消、未入金なら登録として動く */
    isPaid: boolean
    onClose: () => void
}

export function PaymentDialog({ invoiceId, isPaid, onClose }: PaymentDialogProps) {
    // 入金日の初期値は今日。開くたびに作り直されるよう、呼び出し側は開いている間だけこれを描画する
    const [paymentData, setPaymentData] = useState({ paidAt: new Date().toISOString().split('T')[0], memo: '' })
    const createPaymentMutation = useCreatePaymentMutation()
    const cancelPaymentMutation = useCancelPaymentMutation()
    const saving = createPaymentMutation.isPending || cancelPaymentMutation.isPending

    const handleSave = async () => {
        try {
            if (isPaid) {
                await cancelPaymentMutation.mutateAsync({ invoiceId, data: paymentData })
            } else {
                await createPaymentMutation.mutateAsync({ invoiceId, data: paymentData })
            }
            // 一覧と各画面の進捗表示は useCreatePaymentMutation 側で取り直される
            onClose()
        } catch (error) {
            handleOperationError(error, isPaid ? '入金の取消に失敗しました' : '入金の登録に失敗しました')
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(1, 8, 62, 0.55)' }}
            onClick={onClose}
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
                        {isPaid ? 'CANCEL PAYMENT' : 'REGISTER PAYMENT'}
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
                        {isPaid ? '入金取消' : '入金登録'}
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
                        type="button"
                        onClick={onClose}
                        disabled={saving}
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
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="font-mincho transition-colors text-white"
                        style={{
                            padding: '12px 32px',
                            backgroundColor: saving ? '#d1d5db' : isPaid ? 'var(--brand-red)' : 'var(--brand-navy)',
                            border: 'none',
                            fontSize: '15px',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                            cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {saving ? '処理中…' : isPaid ? '取　消' : '保　存'}
                    </button>
                </div>
            </div>
        </div>
    )
}
