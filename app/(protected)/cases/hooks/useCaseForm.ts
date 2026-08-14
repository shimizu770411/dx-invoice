import { useCallback } from 'react'

export function useCaseFormData() {
    const normalizeDateString = (value: string): string => {
        // Convert 'YYYY-MM-DD HH:mm:ss.SSS +0900' -> 'YYYY-MM-DDTHH:mm:ss.SSS+09:00'
        const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?) ([+-]\d{4})$/)
        if (!match) return value

        const [, date, time, offset] = match
        const offsetWithColon = `${offset.slice(0, 3)}:${offset.slice(3)}`
        return `${date}T${time}${offsetWithColon}`
    }

    // 日付を安全に変換する関数（datetime-local入力用）
    // UTC時刻をローカルタイムゾーンに変換して表示
    const formatDateForInput = useCallback((dateValue: string | Date | null | undefined): string => {
        if (!dateValue) return ''
        try {
            const date = typeof dateValue === 'string' ? new Date(normalizeDateString(dateValue)) : dateValue
            if (isNaN(date.getTime())) return ''

            // ローカルタイムゾーンで表示
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')

            return `${year}-${month}-${day}T${hours}:${minutes}`
        } catch {
            return ''
        }
    }, [])

    // 日付を安全に変換する関数（ISO文字列用）
    // datetime-local入力はローカルタイムゾーンで解釈されるため、UTCに変換する
    const formatDateForISO = useCallback((dateValue: string | null | undefined): string | null => {
        if (!dateValue) return null
        try {
            const date = new Date(dateValue)
            if (isNaN(date.getTime())) return null
            return date.toISOString()
        } catch {
            return null
        }
    }, [])

    return { formatDateForInput, formatDateForISO }
}
