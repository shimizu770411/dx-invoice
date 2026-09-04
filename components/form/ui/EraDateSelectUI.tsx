'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEraParts, buildEraOptions, formatEraYear, type EraYearEntry } from '@/lib/era'

interface EraDateSelectUIProps {
    /** ISO形式 (YYYY-MM-DD)。年月日が揃うまでは空文字を返す */
    value?: string
    onChange: (value: string) => void
    label?: string
    required?: boolean
    disabled?: boolean
    error?: string
    minYear?: number
    maxYear?: number
}

type InputMode = 'western' | 'japanese'

const DEFAULT_MIN_YEAR = 1900
const PLACEHOLDER = '-'

interface DateParts {
    year: number | null
    month: number | null
    day: number | null
}

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

function daysInMonth(year: number | null, month: number | null): number {
    if (!year || !month) return 31
    return new Date(year, month, 0).getDate()
}

// 保存済みデータがフルISO日時文字列（例: toISOString()の"1989-01-05T00:00:00.000Z"）で
// 渡されるケースがあるため、先頭のyyyy-mm-dd部分だけを見て解釈する
function parseIsoDate(value: string): DateParts {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return { year: null, month: null, day: null }
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) }
}

function toIso(parts: DateParts): string {
    return parts.year && parts.month && parts.day ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : ''
}

/** 画面表示専用のフォーマット。内部で保持・送信する値はISO(yyyy-mm-dd)のまま */
function formatDisplay(parts: DateParts): string {
    return parts.year && parts.month && parts.day ? `${parts.year}/${pad(parts.month)}/${pad(parts.day)}` : ''
}

function uniqueEras(eraOptions: EraYearEntry[]): string[] {
    const seen = new Set<string>()
    const list: string[] = []
    eraOptions.forEach((o) => {
        if (!seen.has(o.era)) {
            seen.add(o.era)
            list.push(o.era)
        }
    })
    return list
}

export function EraDateSelectUI({
    value = '',
    onChange,
    label,
    required,
    disabled,
    error,
    minYear = DEFAULT_MIN_YEAR,
    maxYear = new Date().getFullYear(),
}: EraDateSelectUIProps) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<InputMode>('western')
    // ポップオーバーを開いている間だけの編集中の値。「確定」を押すまでonChangeは呼ばない。
    const [draft, setDraft] = useState<DateParts>({ year: null, month: null, day: null })
    // 和暦モードで元号だけ選び、和暦年をまだ選んでいない間の一時状態
    const [pendingEra, setPendingEra] = useState<string | null>(null)

    const committed = parseIsoDate(value)
    // 保存済みの値がminYear/maxYearの範囲外にある場合、その値を含むように実効範囲を広げる。
    // そうしないと既存データを開いた際に年selectがどのoptionにも一致せず空欄に見え、誤って上書きされる事故につながる。
    const effectiveMinYear = committed.year && committed.year < minYear ? committed.year : minYear
    const effectiveMaxYear = committed.year && committed.year > maxYear ? committed.year : maxYear
    // buildEraOptionsはIntl.DateTimeFormatを年数分呼び出す重い処理のため、実効範囲が変わらない限り再計算しない
    const eraOptions = useMemo(
        () => buildEraOptions(effectiveMinYear, effectiveMaxYear),
        [effectiveMinYear, effectiveMaxYear]
    )

    const handleOpenChange = (next: boolean) => {
        if (next) {
            setDraft(committed)
            setPendingEra(null)
            setOpen(true)
        } else {
            setOpen(false)
        }
    }

    const handleModeChange = (nextMode: InputMode) => {
        setMode(nextMode)
        setPendingEra(null)
    }

    const referenceEra = draft.year ? getEraParts(new Date(draft.year, (draft.month ?? 1) - 1, draft.day ?? 1)) : null
    const currentEra = pendingEra ?? referenceEra?.era ?? null
    const currentEraYear = pendingEra ? null : (referenceEra?.eraYear ?? null)
    const matchedEntry =
        currentEra && currentEraYear != null
            ? (eraOptions.find((o) => o.era === currentEra && o.eraYear === currentEraYear) ?? null)
            : null

    const monthLo = matchedEntry?.startMonth ?? 1
    const monthHi = matchedEntry?.endMonth ?? 12
    const monthOptions = Array.from({ length: monthHi - monthLo + 1 }, (_, i) => monthLo + i)

    const dayLo = matchedEntry && draft.month === matchedEntry.startMonth ? matchedEntry.startDay : 1
    const dayHi =
        matchedEntry && draft.month === matchedEntry.endMonth
            ? Math.min(daysInMonth(draft.year, draft.month), matchedEntry.endDay)
            : daysInMonth(draft.year, draft.month)
    const dayOptions = Array.from({ length: Math.max(dayHi - dayLo + 1, 0) }, (_, i) => dayLo + i)

    const yearOptions = Array.from({ length: effectiveMaxYear - effectiveMinYear + 1 }, (_, i) => effectiveMaxYear - i)

    const handleEraChange = (era: string) => {
        setPendingEra(era || null)
        setDraft({ year: null, month: null, day: null })
    }

    const handleEraYearChange = (eraYearValue: string) => {
        if (!eraYearValue) {
            setDraft((prev) => ({ ...prev, year: null }))
            return
        }
        const era = pendingEra ?? currentEra
        const entry = era
            ? (eraOptions.find((o) => o.era === era && o.eraYear === parseInt(eraYearValue, 10)) ?? null)
            : null
        if (!entry) return
        setPendingEra(null)
        setDraft((prev) => {
            const validMonth =
                prev.month != null && prev.month >= entry.startMonth && prev.month <= entry.endMonth ? prev.month : null
            const lo = validMonth === entry.startMonth ? entry.startDay : 1
            const hi =
                validMonth === entry.endMonth
                    ? Math.min(daysInMonth(entry.westernYear, validMonth), entry.endDay)
                    : daysInMonth(entry.westernYear, validMonth)
            const validDay =
                validMonth != null && prev.day != null && prev.day >= lo && prev.day <= hi ? prev.day : null
            return { year: entry.westernYear, month: validMonth, day: validDay }
        })
    }

    const handleJapaneseMonthChange = (monthValue: string) => {
        const nextMonth = monthValue ? parseInt(monthValue, 10) : null
        setDraft((prev) => {
            const lo = matchedEntry && nextMonth === matchedEntry.startMonth ? matchedEntry.startDay : 1
            const hi =
                matchedEntry && nextMonth === matchedEntry.endMonth
                    ? Math.min(daysInMonth(prev.year, nextMonth), matchedEntry.endDay)
                    : daysInMonth(prev.year, nextMonth)
            const validDay = prev.day != null && prev.day >= lo && prev.day <= hi ? prev.day : null
            return { ...prev, month: nextMonth, day: validDay }
        })
    }

    const handleConfirm = () => {
        onChange(toIso(draft))
        setOpen(false)
    }

    const canConfirm = draft.year != null && draft.month != null && draft.day != null

    const selectClass = 'w-full rounded border border-gray-300 bg-white px-3 py-3 text-2xl cursor-pointer'

    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverAnchor asChild>
                    <div
                        className={cn(
                            'flex w-full items-center rounded border px-3 py-2 text-xl',
                            error ? 'border-red-500' : 'border-gray-300',
                            disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'cursor-pointer bg-white'
                        )}
                        onClick={() => !disabled && handleOpenChange(true)}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-gray-600" />
                        <span className={committed.year ? 'text-gray-900' : 'text-gray-500'}>
                            {formatDisplay(committed) || '日付を選択'}
                        </span>
                    </div>
                </PopoverAnchor>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="bg-white p-6">
                        <div className="mb-4 inline-flex gap-1 rounded-full border border-gray-300 p-1">
                            <Button
                                type="button"
                                size="lg"
                                variant="ghost"
                                className={cn(
                                    'rounded-full text-lg',
                                    mode === 'western' &&
                                        'bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy)] hover:text-white'
                                )}
                                onClick={() => handleModeChange('western')}
                            >
                                西暦で入力
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                variant="ghost"
                                className={cn(
                                    'rounded-full text-lg',
                                    mode === 'japanese' &&
                                        'bg-[var(--brand-navy)] text-white hover:bg-[var(--brand-navy)] hover:text-white'
                                )}
                                onClick={() => handleModeChange('japanese')}
                            >
                                和暦で入力
                            </Button>
                        </div>

                        {mode === 'western' ? (
                            <div className="grid grid-cols-3 gap-3">
                                <select
                                    className={selectClass}
                                    value={draft.year ?? ''}
                                    onChange={(e) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            year: e.target.value ? parseInt(e.target.value, 10) : null,
                                        }))
                                    }
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {yearOptions.map((y) => (
                                        <option key={y} value={y}>
                                            {y}年
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className={selectClass}
                                    value={draft.month ?? ''}
                                    onChange={(e) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            month: e.target.value ? parseInt(e.target.value, 10) : null,
                                        }))
                                    }
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {m}月
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className={selectClass}
                                    value={draft.day ?? ''}
                                    onChange={(e) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            day: e.target.value ? parseInt(e.target.value, 10) : null,
                                        }))
                                    }
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {Array.from({ length: daysInMonth(draft.year, draft.month) }, (_, i) => i + 1).map(
                                        (d) => (
                                            <option key={d} value={d}>
                                                {d}日
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-3">
                                <select
                                    className={selectClass}
                                    value={currentEra ?? ''}
                                    onChange={(e) => handleEraChange(e.target.value)}
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {uniqueEras(eraOptions).map((era) => (
                                        <option key={era} value={era}>
                                            {era}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className={selectClass}
                                    value={currentEraYear ?? ''}
                                    onChange={(e) => handleEraYearChange(e.target.value)}
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {currentEra &&
                                        eraOptions
                                            .filter((o) => o.era === currentEra)
                                            .map((o) => (
                                                <option key={o.eraYear} value={o.eraYear}>
                                                    {formatEraYear(o.eraYear)}
                                                </option>
                                            ))}
                                </select>
                                <select
                                    className={selectClass}
                                    value={draft.month ?? ''}
                                    onChange={(e) => handleJapaneseMonthChange(e.target.value)}
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {monthOptions.map((m) => (
                                        <option key={m} value={m}>
                                            {m}月
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className={selectClass}
                                    value={draft.day ?? ''}
                                    onChange={(e) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            day: e.target.value ? parseInt(e.target.value, 10) : null,
                                        }))
                                    }
                                >
                                    <option value="">{PLACEHOLDER}</option>
                                    {dayOptions.map((d) => (
                                        <option key={d} value={d}>
                                            {d}日
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="mt-5 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="text-lg"
                                onClick={() => setOpen(false)}
                            >
                                キャンセル
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                className="text-lg"
                                onClick={handleConfirm}
                                disabled={!canConfirm}
                            >
                                確定
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
        </div>
    )
}
