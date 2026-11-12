'use client'

import { useEffect, useState } from 'react'
import { useCreatePaymentMutation, useCancelPaymentMutation } from '@/hooks/usePayment'
import { extractValidationErrorMessage, handleLoadError, handleOperationError } from '@/lib/errorHandler'
import { toast } from '@/hooks/use-toast'
import { isValidReceiptNo, RECEIPT_NO_INVALID_MESSAGE, RECEIPT_NO_LENGTH } from '@/lib/receiptNo'
import {
    defaultReceiptAddressee,
    isValidReceiptAddressee,
    normalizeReceiptAddressee,
    RECEIPT_ADDRESSEE_MAX_LENGTH,
    RECEIPT_ADDRESSEE_TOO_LONG_MESSAGE,
} from '@/lib/receiptAddressee'
import { getInvoice } from '@/lib/invoices'

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
    // 領収書No.（任意・数字7桁）。請求書PDFの押印欄の No に出す。入金登録のときだけ入力する
    const [receiptNo, setReceiptNo] = useState('')
    // 領収書の宛名。支払者と喪主のどちらに宛てるかは案件で違うため、入金登録のときに選ぶ。
    // 初期値は支払者名、それが空なら喪主名（以前の領収書と同じ宛名）
    const [receiptAddressee, setReceiptAddressee] = useState('')
    const [names, setNames] = useState<{ payerName: string | null; chiefMournerName: string | null }>({
        payerName: null,
        chiefMournerName: null,
    })
    useEffect(() => {
        if (isPaid) return
        let cancelled = false
        getInvoice(invoiceId)
            .then((invoice) => {
                if (cancelled) return
                const payerName = normalizeReceiptAddressee(invoice.customer?.payerName)
                const chiefMournerName = normalizeReceiptAddressee(invoice.customer?.chiefMournerName)
                setNames({ payerName, chiefMournerName })
                // 読み込み中に入力を始めていたら、その入力を消さない
                setReceiptAddressee((current) => current || defaultReceiptAddressee({ payerName, chiefMournerName }))
            })
            .catch((error) => {
                if (!cancelled) handleLoadError(error)
            })
        return () => {
            cancelled = true
        }
    }, [invoiceId, isPaid])
    const createPaymentMutation = useCreatePaymentMutation()
    const cancelPaymentMutation = useCancelPaymentMutation()
    const saving = createPaymentMutation.isPending || cancelPaymentMutation.isPending

    const handleSave = async () => {
        if (!isPaid && !isValidReceiptNo(receiptNo)) {
            toast({ title: RECEIPT_NO_INVALID_MESSAGE, variant: 'destructive', duration: 3000 })
            return
        }
        if (!isPaid && !isValidReceiptAddressee(receiptAddressee)) {
            toast({ title: RECEIPT_ADDRESSEE_TOO_LONG_MESSAGE, variant: 'destructive', duration: 3000 })
            return
        }
        try {
            if (isPaid) {
                await cancelPaymentMutation.mutateAsync({ invoiceId, data: paymentData })
            } else {
                await createPaymentMutation.mutateAsync({
                    invoiceId,
                    data: { ...paymentData, receiptNo: receiptNo.trim(), receiptAddressee: receiptAddressee.trim() },
                })
            }
            // 一覧と各画面の進捗表示は useCreatePaymentMutation 側で取り直される
            onClose()
        } catch (error) {
            // 領収書No.の形が正しくないなど、サーバーが理由を返した場合はそれを見せる
            handleOperationError(
                error,
                extractValidationErrorMessage(error) ?? (isPaid ? '入金の取消に失敗しました' : '入金の登録に失敗しました')
            )
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

                {/* 領収書の宛名（入金登録のときだけ。取消では入力しない） */}
                {!isPaid && (
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
                            領収書の宛名
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                maxLength={RECEIPT_ADDRESSEE_MAX_LENGTH}
                                value={receiptAddressee}
                                onChange={(e) => setReceiptAddressee(e.target.value)}
                                className="min-w-0 flex-1 focus:outline-none transition-colors"
                                style={{
                                    padding: '12px 14px',
                                    fontSize: '16px',
                                    border: '1px solid var(--brand-input-border)',
                                    backgroundColor: 'var(--brand-ivory-light)',
                                }}
                            />
                            {/* 案件に登録された支払者・喪主の名前をワンタッチで入れる */}
                            {([
                                ['支払者', names.payerName],
                                ['喪主', names.chiefMournerName],
                            ] as const).map(([label, name]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => name && setReceiptAddressee(name)}
                                    disabled={!name}
                                    title={name ? `${label}の名前（${name}）を入れる` : `${label}の名前が登録されていません`}
                                    className="shrink-0 font-mincho transition-colors"
                                    style={{
                                        padding: '0 12px',
                                        backgroundColor: '#ffffff',
                                        color: name ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
                                        border: '1px solid var(--brand-border)',
                                        fontSize: '13px',
                                        letterSpacing: '0.1em',
                                        cursor: name ? 'pointer' : 'not-allowed',
                                        opacity: name ? 1 : 0.5,
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 領収書No.（入金登録のときだけ。取消では入力しない） */}
                {!isPaid && (
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
                            領収書No.
                            <span style={{ fontSize: '12px', color: 'var(--brand-text-muted)', marginLeft: '8px', letterSpacing: '0.05em' }}>
                                {RECEIPT_NO_LENGTH}桁の数字（空欄でも登録できます）
                            </span>
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={RECEIPT_NO_LENGTH}
                            placeholder="例: 6253108"
                            value={receiptNo}
                            onChange={(e) => setReceiptNo(e.target.value)}
                            className="w-full focus:outline-none transition-colors"
                            style={{
                                padding: '12px 14px',
                                fontSize: '16px',
                                letterSpacing: '0.1em',
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                            }}
                        />
                    </div>
                )}

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
