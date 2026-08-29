'use client'

import { useState, useEffect } from 'react'

interface AgeCalculatorDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: (age: number) => void
    baseDate?: string // 計算基準日の初期値（ISO形式など）。省略時は本日
}

// 行年は数え年（その人が生きて経験した暦年の総数）で算出する。
// 数え年 = 計算基準日の年 - 生年 + 1（誕生日が来ているかどうかは問わない）
function calcAge(birthISO: string, baseISO: string): number | null {
    if (!birthISO) return null
    const birth = new Date(birthISO)
    const base = new Date(baseISO)
    if (isNaN(birth.getTime()) || isNaN(base.getTime())) return null
    if (birth > base) return null
    const age = base.getFullYear() - birth.getFullYear() + 1
    return age < 1 ? null : age
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
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
    const d = new Date(value)
    if (isNaN(d.getTime())) return todayISO()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

// 年から和暦を生成（例: 1945 → "昭和20年"）
function toJapaneseEra(year: number): string {
    if (year >= 2019) return `令和${year - 2018}年`
    if (year >= 1989) return `平成${year - 1988}年`
    if (year >= 1926) return `昭和${year - 1925}年`
    if (year >= 1912) return `大正${year - 1911}年`
    if (year >= 1868) return `明治${year - 1867}年`
    return ''
}

function getDaysInMonth(year: number, month: number): number {
    if (!year || !month) return 31
    return new Date(year, month, 0).getDate()
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export function AgeCalculatorDialog({ open, onClose, onConfirm, baseDate }: AgeCalculatorDialogProps) {
    const [birthYear, setBirthYear] = useState('')
    const [birthMonth, setBirthMonth] = useState('')
    const [birthDay, setBirthDay] = useState('')
    const [base, setBase] = useState(normalizeDate(baseDate))

    useEffect(() => {
        if (open) {
            setBirthYear('')
            setBirthMonth('')
            setBirthDay('')
            setBase(normalizeDate(baseDate))
        }
    }, [open, baseDate])

    if (!open) return null

    const yearNum = parseInt(birthYear)
    const monthNum = parseInt(birthMonth)
    const dayNum = parseInt(birthDay)
    const daysInMonth = getDaysInMonth(yearNum, monthNum)
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    // 選択中の日が月末を超えていたらリセット
    const effectiveDay = dayNum > daysInMonth ? '' : birthDay

    const birthISO =
        birthYear && birthMonth && effectiveDay
            ? `${birthYear}-${birthMonth.padStart(2, '0')}-${effectiveDay.padStart(2, '0')}`
            : ''

    const japaneseEra = yearNum ? toJapaneseEra(yearNum) : ''
    const age = calcAge(birthISO, base)

    const selectStyle: React.CSSProperties = {
        padding: '12px 10px',
        fontSize: '17px',
        border: '1px solid var(--brand-input-border)',
        backgroundColor: 'var(--brand-ivory-light)',
        fontFamily: 'var(--font-mincho)',
        letterSpacing: '0.05em',
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'%23666\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: '30px',
        cursor: 'pointer',
    }

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
                        style={{ fontSize: '11px', color: 'var(--brand-gold-soft)', letterSpacing: '0.3em', fontWeight: 500 }}
                    >
                        AGE CALCULATION
                    </p>
                    <h2
                        className="font-mincho"
                        style={{ fontSize: '20px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.2em' }}
                    >
                        行年の自動算出
                    </h2>
                </div>

                {/* 生年月日 — 年・月・日セレクト */}
                <div className="mb-5">
                    <label className="brand-label">生年月日</label>
                    <div className="flex items-center gap-2">
                        {/* 年 */}
                        <select
                            value={birthYear}
                            onChange={(e) => setBirthYear(e.target.value)}
                            style={{ ...selectStyle, flex: '3' }}
                        >
                            <option value="">年</option>
                            {YEARS.map((y) => (
                                <option key={y} value={String(y)}>
                                    {y}年（{toJapaneseEra(y)}）
                                </option>
                            ))}
                        </select>
                        {/* 月 */}
                        <select
                            value={birthMonth}
                            onChange={(e) => setBirthMonth(e.target.value)}
                            style={{ ...selectStyle, flex: '2' }}
                        >
                            <option value="">月</option>
                            {MONTHS.map((m) => (
                                <option key={m} value={String(m)}>{m}月</option>
                            ))}
                        </select>
                        {/* 日 */}
                        <select
                            value={effectiveDay}
                            onChange={(e) => setBirthDay(e.target.value)}
                            style={{ ...selectStyle, flex: '2' }}
                        >
                            <option value="">日</option>
                            {days.map((d) => (
                                <option key={d} value={String(d)}>{d}日</option>
                            ))}
                        </select>
                    </div>
                    {/* 和暦表示 */}
                    {japaneseEra && (
                        <p
                            className="mt-1 text-right font-mincho"
                            style={{ fontSize: '13px', color: 'var(--brand-gold-soft)', letterSpacing: '0.1em' }}
                        >
                            {birthYear}年 = {japaneseEra}
                        </p>
                    )}
                </div>

                {/* 計算基準日 */}
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
                        style={{ fontSize: '11px', color: 'var(--brand-gold-soft)', letterSpacing: '0.3em' }}
                    >
                        RESULT
                    </p>
                    {age !== null ? (
                        <div
                            className="font-mincho"
                            style={{ fontSize: '28px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.1em' }}
                        >
                            <span
                                style={{
                                    fontSize: '44px',
                                    margin: '0 6px',
                                    fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                }}
                            >
                                {age}
                            </span>
                            歳（数え）
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
