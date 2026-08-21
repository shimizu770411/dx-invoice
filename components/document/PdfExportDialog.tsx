'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { openPdfExport } from '@/lib/pdfExport'

interface PdfExportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pdfEndpoint: string | null
}

export function PdfExportDialog({ open, onOpenChange, pdfEndpoint }: PdfExportDialogProps) {
    const openPdf = (includeOptions: boolean) => {
        if (pdfEndpoint) {
            openPdfExport(pdfEndpoint, includeOptions)
        }
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" style={{ borderColor: 'var(--brand-border)', borderRadius: '16px' }}>
                <DialogHeader>
                    <DialogTitle
                        className="font-mincho"
                        style={{ color: 'var(--brand-navy)', fontSize: '19px', letterSpacing: '0.08em', fontWeight: 600 }}
                    >
                        PDF出力設定
                    </DialogTitle>
                    <DialogDescription
                        className="font-mincho"
                        style={{ color: 'var(--brand-text-muted)', fontSize: '13px', letterSpacing: '0.03em', lineHeight: 1.8 }}
                    >
                        各明細で選択した種類の画像を、PDF末尾に一覧ページとして含めますか？
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="!grid !grid-cols-2 gap-3 sm:space-x-0">
                    <button
                        type="button"
                        onClick={() => openPdf(false)}
                        className="font-mincho cursor-pointer"
                        style={{
                            padding: '14px 12px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            borderRadius: '10px',
                            fontSize: '14px',
                            letterSpacing: '0.1em',
                            lineHeight: 1.6,
                        }}
                    >
                        含めない
                        <br />
                        （非表示）
                    </button>
                    <button
                        type="button"
                        onClick={() => openPdf(true)}
                        className="font-mincho cursor-pointer"
                        style={{
                            padding: '14px 12px',
                            backgroundColor: 'var(--brand-navy)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            letterSpacing: '0.1em',
                            lineHeight: 1.6,
                        }}
                    >
                        含めて出力
                        <br />
                        （表示）
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
