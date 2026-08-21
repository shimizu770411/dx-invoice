import { useQuery } from '@tanstack/react-query'
import { getCompanyProfile } from '@/lib/company'

/**
 * 自社設定の PDF 出力オプション（pdfPromptOnExport / pdfShowOptionImages）を読み込む hook。
 * useDateFormat と queryKey を共用するため、追加の API コールは発生しない。
 */
export function usePdfExportSettings(): { promptOnExport: boolean; showOptionImages: boolean } {
    const { data: profile } = useQuery({
        queryKey: ['companyProfile'],
        queryFn: getCompanyProfile,
        staleTime: 1000 * 60 * 5,
    })

    return {
        promptOnExport: profile?.pdfPromptOnExport ?? true,
        showOptionImages: profile?.pdfShowOptionImages ?? false,
    }
}
