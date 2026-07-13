/**
 * 日付文字列を西暦表示でフォーマット（例: 2025年3月31日）
 */
export function formatDateWestern(dateString: string | null | undefined): string {
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
export function formatDateJapanese(dateString: string | null | undefined): string {
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

/**
 * dateFormat 設定に基づいて日付をフォーマット
 */
export function formatDateByFormat(
    dateString: string | null | undefined,
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
