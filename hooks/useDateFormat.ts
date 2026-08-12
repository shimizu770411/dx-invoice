import { useQuery } from '@tanstack/react-query'
import { getCompanyProfile } from '@/lib/company'
import { formatDateByFormat } from '@/lib/dateUtils'

/**
 * 自社設定の dateFormat を読み込み、日付フォーマット関数を返す hook。
 * 設定取得中はデフォルトで西暦を使用する。
 *
 * 使用例:
 *   const formatDate = useDateFormat()
 *   formatDate('2025-03-31') // → "2025年3月31日" or "令和7年3月31日"
 */
export function useDateFormat(): (dateString: string | Date | null | undefined) => string {
    const { data: profile } = useQuery({
        queryKey: ['companyProfile'],
        queryFn: getCompanyProfile,
        staleTime: 1000 * 60 * 5,
    })

    const dateFormat = profile?.dateFormat === 'JAPANESE' ? 'JAPANESE' : 'WESTERN'

    return (dateString) => formatDateByFormat(dateString, dateFormat)
}
