/**
 * 日付文字列を西暦表示でフォーマット（例: 2025年3月31日）
 */
export function formatDateWestern(dateString: string | Date | null | undefined): string {
    if (!dateString) return ''
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return ''
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date)
    } catch {
        return ''
    }
}

/**
 * 日付文字列を和暦表示でフォーマット（例: 令和7年3月31日）
 */
export function formatDateJapanese(dateString: string | Date | null | undefined): string {
    if (!dateString) return ''
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return ''
        return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
            era: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date)
    } catch {
        return ''
    }
}

// 新しい元号から順に並べる（開始日以降ならその元号）
const ERA_SHORT_TABLE = [
    { letter: 'R', start: '2019-05-01', startYear: 2019 },
    { letter: 'H', start: '1989-01-08', startYear: 1989 },
    { letter: 'S', start: '1926-12-25', startYear: 1926 },
    { letter: 'T', start: '1912-07-30', startYear: 1912 },
    { letter: 'M', start: '1868-01-25', startYear: 1868 },
] as const

/**
 * 日付を元号記号＋yy/mm/dd の短い和暦でフォーマット（例: H21/09/08, R01/06/27）
 * PDFの会員表など、幅の狭い欄で使う。
 *
 * 会員の入会日・完納日はDBの日付型で、`2009-09-08T00:00:00.000Z` の形で届く。
 * new Date して地域の時刻で読むと、日本より西のタイムゾーンでは前日になるため、
 * 文字列は先頭の年月日をそのまま読み、Date は UTC の年月日で読む。
 */
export function formatDateEraShort(value: string | Date | null | undefined): string {
    if (!value) return ''
    let ymd: string
    if (typeof value === 'string') {
        const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
        if (!m) return ''
        ymd = m[1]
    } else {
        if (isNaN(value.getTime())) return ''
        ymd = value.toISOString().slice(0, 10)
    }
    const era = ERA_SHORT_TABLE.find((e) => ymd >= e.start)
    if (!era) return ''
    const [y, mm, dd] = ymd.split('-')
    const eraYear = String(Number(y) - era.startYear + 1).padStart(2, '0')
    return `${era.letter}${eraYear}/${mm}/${dd}`
}

/**
 * dateFormat 設定に基づいて日付をフォーマット
 */
export function formatDateByFormat(
    dateString: string | Date | null | undefined,
    dateFormat: 'WESTERN' | 'JAPANESE'
): string {
    return dateFormat === 'JAPANESE'
        ? formatDateJapanese(dateString)
        : formatDateWestern(dateString)
}

/**
 * 日付文字列を解析し、検索用の From/To 日付に変換
 * @param input - ユーザー入力 ("2026" | "2026-02" | "2026-02-18")
 * @returns { from: string, to: string } 形式
 */
export function parseDateRange(input: string): { from: string; to: string } | null {
    if (!input) return null

    const trimmed = input.trim()

    // YYYY-MM-DD 形式
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return { from: trimmed, to: trimmed }
    }

    // YYYY-MM 形式
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
        const [year, month] = trimmed.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        return {
            from: `${year}-${month}-01`,
            to: `${year}-${month}-${lastDay}`,
        }
    }

    // YYYY 形式
    if (/^\d{4}$/.test(trimmed)) {
        return {
            from: `${trimmed}-01-01`,
            to: `${trimmed}-12-31`,
        }
    }

    return null
}

/**
 * 範囲検索用に From/To を計算
 * @param fromInput - From 入力値
 * @param toInput - To 入力値
 * @returns { from: string, to: string } API 送信用の日付
 */
export function calculateDateRange(fromInput?: string, toInput?: string): { from?: string; to?: string } {
    const result: { from?: string; to?: string } = {}

    if (fromInput) {
        const parsed = parseDateRange(fromInput)
        if (parsed) {
            result.from = parsed.from
        }
    }

    if (toInput) {
        const parsed = parseDateRange(toInput)
        if (parsed) {
            result.to = parsed.to
        }
    }

    return result
}
