'use client'

import { useEffect, useState } from 'react'
import { changeEstimateDocNo } from '@/lib/estimates'
import { DOC_NO_LENGTH, isValidDocNo } from '@/lib/documentUtils'
import { extractValidationErrorMessage, handleOperationError } from '@/lib/errorHandler'

interface Props {
    open: boolean
    estimateId: string
    currentDocNo: string | null | undefined
    onClose: () => void
    onChanged: (docNo: string) => void
}

// 請求書作成済みの本見積の見積番号を変更するダイアログ。
// 間違った番号のまま請求書を作り、その番号を本来付けるべき別の見積で使えなくなったときに使う。
// 請求番号も同じ番号に変わる（見積と請求書で番号を揃える運用）
export function EstimateDocNoChangeDialog({ open, estimateId, currentDocNo, onClose, onChanged }: Props) {
    const [docNo, setDocNo] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (open) setDocNo('')
    }, [open])

    if (!open) return null

    const canSubmitManual = isValidDocNo(docNo) && docNo !== currentDocNo && !isSaving

    const submit = async (params: { docNo: string } | { auto: true }) => {
        setIsSaving(true)
        try {
            const changed = await changeEstimateDocNo(estimateId, params)
            onChanged(changed)
            onClose()
        } catch (error) {
            handleOperationError(error, extractValidationErrorMessage(error) ?? '見積番号の変更に失敗しました')
        } finally {
            setIsSaving(false)
        }
    }

    const secondaryButtonStyle: React.CSSProperties = {
        padding: '12px 28px',
        backgroundColor: '#ffffff',
        color: 'var(--brand-text-muted)',
        border: '1px solid var(--brand-border)',
        fontSize: '15px',
        letterSpacing: '0.2em',
        fontWeight: 500,
        cursor: isSaving ? 'not-allowed' : 'pointer',
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(1, 8, 62, 0.55)' }}
            onClick={isSaving ? undefined : onClose}
        >
            <div
                className="w-full max-w-md bg-white"
                style={{
                    border: '1px solid var(--brand-border)',
                    borderTop: '4px solid var(--brand-navy)',
                    padding: '36px 36px 32px',
                    boxShadow: '0 20px 40px rgba(1, 8, 62, 0.2)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 pb-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                    <h2
                        className="font-mincho"
                        style={{ fontSize: '20px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.2em' }}
                    >
                        見積番号の変更
                    </h2>
                </div>

                <div className="mb-5">
                    <label className="brand-label">現在の見積番号</label>
                    <p className="font-mincho" style={{ fontSize: '17px', color: 'var(--brand-navy)', letterSpacing: '0.05em' }}>
                        {currentDocNo || '（未入力）'}
                    </p>
                </div>

                <div className="mb-5">
                    <label className="brand-label">新しい見積番号</label>
                    <div className="flex items-stretch gap-2">
                        <input
                            type="text"
                            inputMode="numeric"
                            aria-label="新しい見積番号"
                            value={docNo}
                            onChange={(e) => setDocNo(e.target.value.trim())}
                            // 見積画面のフォームの中に出すため、Enterで見積の保存が走らないよう止め、番号の変更として扱う
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                if (canSubmitManual) submit({ docNo })
                            }}
                            placeholder="例: 202607001"
                            maxLength={DOC_NO_LENGTH}
                            disabled={isSaving}
                            className="flex-1"
                            style={{
                                padding: '12px 14px',
                                fontSize: '17px',
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                                fontFamily: 'var(--font-mincho)',
                                letterSpacing: '0.05em',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => submit({ docNo })}
                            disabled={!canSubmitManual}
                            className={`font-mincho whitespace-nowrap rounded border border-transparent px-4 text-sm text-white ${canSubmitManual ? 'cursor-pointer bg-[var(--brand-navy)]' : 'cursor-not-allowed bg-gray-300'}`}
                        >
                            この番号に変更
                        </button>
                    </div>
                    <p className="font-mincho mt-1" style={{ fontSize: '11px', color: 'var(--brand-text-muted)', letterSpacing: '0.05em' }}>
                        年4桁・月2桁・連番3桁の9桁の数字
                    </p>
                </div>

                <div
                    className="mb-6 font-mincho"
                    style={{
                        padding: '12px 14px',
                        fontSize: '13px',
                        lineHeight: 1.7,
                        backgroundColor: 'var(--brand-ivory)',
                        border: '1px solid var(--brand-border)',
                        color: 'var(--brand-text)',
                    }}
                >
                    ・この見積から作った請求書の請求番号も同じ番号に変わります（入金済みでも変わります）。
                    <br />
                    ・お客様にお渡し済みの見積書・請求書は旧番号のままです。
                </div>

                <div className="flex justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => submit({ auto: true })}
                        disabled={isSaving}
                        title="葬儀・告別式の開始日時の年月で、空いている次の番号を付けます"
                        className={`font-mincho whitespace-nowrap rounded border border-transparent px-4 py-2 text-sm text-white ${isSaving ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer bg-[var(--brand-navy-light)]'}`}
                    >
                        {isSaving ? '変更中...' : '自動採番で変更'}
                    </button>
                    <button type="button" onClick={onClose} disabled={isSaving} className="font-mincho transition-colors" style={secondaryButtonStyle}>
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    )
}
