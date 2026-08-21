import { useState } from 'react'
import { usePdfExportSettings } from '@/hooks/usePdfExportSettings'
import { openPdfExport } from '@/lib/pdfExport'

/**
 * PDFボタン押下時の挙動（確認ダイアログを開くか、直接PDFを開くか）と
 * ダイアログの開閉状態をまとめて扱う hook。
 */
export function usePdfExportTrigger(pdfEndpoint: string | null) {
    const { promptOnExport, showOptionImages } = usePdfExportSettings()
    const [pdfDialogOpen, setPdfDialogOpen] = useState(false)

    const handlePdfClick = () => {
        if (promptOnExport) {
            setPdfDialogOpen(true)
        } else if (pdfEndpoint) {
            openPdfExport(pdfEndpoint, showOptionImages)
        }
    }

    return { pdfDialogOpen, setPdfDialogOpen, handlePdfClick }
}
