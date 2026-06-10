'use client'

import { useState, useEffect } from 'react'

interface AgeCalculatorDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (age: number) => void
    baseDate?: string // 計算基準日の初期値（ISO形式など）。省略時は本日
}

function calcAge(birthISO: string, baseISO: string): number | null {
    if (!birthISO) return null
    const birth = new Date(birthISO)
    const base = new Date(baseISO)
    if (isNaN(birth.getTime()) || isNaN(base.getTime())) return null
    if (birth > base) return null
    let age = base.getFullYear() - birth.getFullYear()
    const m = base.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) {
        age--
    }
    return age < 0 ? null : age
}

function todayISO() {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

function normalizeDate(value?: string): string {
    if (!value) return todayISO()
    // datetime-local や ISO 文字列からYYYY-MM-DD部分を抽出
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
    const d = new Date(value)
    if (isNaN(d.getTime())) return todayISO()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

export function AgeCalculatorDialog({ open, onClose, onConfirm, baseDate }: AgeCalculatorDialogProps) {
    const [birth, setBirth] = useState('')
    const [base, setBase] = useState(normalizeDate(baseDate))

    useEffect(() => {
        if (open) {
            setBirth('')
            setBase(normalizeDate(baseDate))
        }
    }, [open, baseDate])

    if (!open) return null

    const age = calcAge(birth, base)

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '14px 16px',
        fontSize: '17px',
        border: '1px solid var(--brand-input-border)',
        backgroundColor: 'var(--brand-ivory-light)',
        fontFamily: 'var(--font-mincho)',
        letterSpacing: '0.05em',
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(1, 8, 62, 0.55)' }}
            onClick={onClose}
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
                {/* ヘッダー */}
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
                        AGE CALCULATION
                    </p>
                    <h2
                        className="font-mincho"
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                        }}
                    >
                        行年の自動算出
                    </h2>
                </div>

                {/* 入力 */}
                <div className="mb-5">
                    <label className="brand-label">生年月日</label>
                    <input
                        type="date"
                        value={birth}
                        onChange={(e) => setBirth(e.target.value)}
                        style={inputStyle}
                        autoFocus
                    />
                </div>
                <div className="mb-6">
                    <label className="brand-label">計算基準日（死亡日・葬儀日など）</label>
                    <input
                        type="date"
                        value={base}
                        onChange={(e) => setBase(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                {/* 結果表示 */}
                <div
                    className="mb-8 text-center"
                    style={{
                        padding: '24px 20px',
                        backgroundColor: 'var(--brand-ivory)',
                        border: '1px solid var(--brand-border)',
                    }}
                >
                    <p
                        className="font-garamond mb-2"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                        }}
                    >
                        RESULT
                    </p>
                    {age !== null ? (
                        <div
                            className="font-mincho"
                            style={{
                                fontSize: '28px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.1em',
                            }}
                        >
                            満
                            <span
                                style={{
                                    fontSize: '44px',
                                    margin: '0 6px',
                                    fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                }}
                            >
                                {age}
                            </span>
                            歳
                        </div>
                    ) : (
                        <p
                            style={{
                                fontSize: '15px',
                                color: 'var(--brand-text-muted)',
                                fontFamily: 'var(--font-mincho)',
                                letterSpacing: '0.15em',
                            }}
                        >
                            生年月日を入力してください
                        </p>
                    )}
                </div>

                {/* アクション */}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="font-mincho transition-colors"
                        style={{
                            padding: '12px 28px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            fontSize: '15px',
                            letterSpacing: '0.2em',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (age !== null) {
                                onConfirm(age)
                                onClose()
                            }
                        }}
                        disabled={age === null}
                        className="font-mincho transition-colors text-white"
                        style={{
                            padding: '12px 36px',
                            backgroundColor: age === null ? '#c0c0c0' : 'var(--brand-navy)',
                            border: 'none',
                            fontSize: '15px',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                            cursor: age === null ? 'not-allowed' : 'pointer',
                            boxShadow: age === null ? 'none' : '0 2px 4px rgba(1, 8, 62, 0.15)',
                        }}
                    >
                        反　映
                    </button>
                </div>
            </div>
        </div>
    )
}
