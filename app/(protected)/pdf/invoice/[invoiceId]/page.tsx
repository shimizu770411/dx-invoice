'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { getInvoice } from '@/lib/invoices'
import { getProducts } from '@/lib/products'
import { getCompanyProfile } from '@/lib/company'
import { DEFAULT_FREE_ITEM_DISPLAY, FreeItemDisplay, toFreeItemDisplay } from '@/lib/pdfFreeItemDisplay'
import { buildBankTransferLines } from '@/lib/separateFees'
import { applyPlanToPdfDocument } from '@/lib/pdfDocumentPlan'
import { CreateButton } from '@/components/button/CreateButton'
import { ResetButton } from '@/components/button/ResetButton'
import { toast } from '@/hooks/use-toast'
import { PdfInvoiceLayout, PDF_VIEWPORT_WIDTH_PX } from '@/app/(protected)/pdf/components/PdfInvoiceLayout'
import { buildInvoicePaymentStamp } from '@/lib/invoicePaymentStamp'

export default function InvoicePdfPage() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const invoiceId = params.invoiceId as string
    const hideSelectedOptions = searchParams.get('showOptions') === 'false'
    const [loading, setLoading] = useState(true)
    const [invoice, setInvoice] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [bankTransferLines, setBankTransferLines] = useState<string[]>([])
    const [freeItemDisplay, setFreeItemDisplay] = useState<FreeItemDisplay>(DEFAULT_FREE_ITEM_DISPLAY)
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceId])

    const loadData = async () => {
        try {
            const [invoiceData, productsData] = await Promise.all([getInvoice(invoiceId), getProducts()])

            // 備考欄の最下部に出す振込先と、自由入力行の単価・数量を出すか（自社情報管理の設定）。
            // 取得に失敗しても請求書自体は表示できるよう、ここだけ個別にフォールバックして
            // 振込先なし・単価と数量は従来どおり出す形で描画する
            try {
                const company = await getCompanyProfile()
                setFreeItemDisplay(toFreeItemDisplay(company))
                setBankTransferLines(
                    buildBankTransferLines({
                        name: company.bank1Name,
                        branch: company.bank1Branch,
                        type: company.bank1Type,
                        account: company.bank1Account,
                        holder: company.bank1Holder,
                    })
                )
            } catch (companyError) {
                console.error('Failed to load company profile:', companyError)
            }

            // プラン別商品設定を明細と商品リストに反映する（見積・領収書のPDFと共通）
            const { document: patchedInvoice, products: overriddenProducts } = await applyPlanToPdfDocument(
                invoiceData as any,
                productsData
            )

            setInvoice(patchedInvoice)
            setProducts(overriddenProducts)
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleGeneratePDF = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/pdf/invoice/${invoiceId}?download`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `請求書_${invoice?.docNo || invoiceId}_${new Date().toISOString().split('T')[0]}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            toast({ title: 'PDFの生成に失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return <div className="p-8">読み込み中...</div>
    }

    if (!invoice) {
        return <div className="p-8">請求書が見つかりません</div>
    }

    return (
        // 幅・パディングは実際のPDF生成時(Puppeteerビューポート+API側のbody padding)と
        // 完全に一致させる。ここがズレるとテキストの折返しが変わり、プレビューと
        // 本番PDFでヘッダー・フッターの高さが食い違う。
        <div className="mx-auto" style={{ width: `${PDF_VIEWPORT_WIDTH_PX}px`, padding: '16px' }}>
            {generating && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700" />
                    <p className="text-sm text-gray-600">PDF を生成しています...</p>
                </div>
            )}
            <div className="mb-8 flex justify-start gap-3">
                <CreateButton disabled={generating} onClick={handleGeneratePDF}>
                    {generating ? '生成中...' : 'PDFダウンロード'}
                </CreateButton>
                <ResetButton onClick={() => router.back()}>閉じる</ResetButton>
            </div>

            {/* 請求書レイアウト */}
            <PdfInvoiceLayout
                contentId="invoice-pdf-content"
                title="家御葬儀請求書"
                document={invoice}
                products={products}
                hideSelectedOptions={hideSelectedOptions}
                showInvoiceFees
                remarksFooterLines={bankTransferLines}
                paymentStamp={buildInvoicePaymentStamp(invoice)}
                freeItemDisplay={freeItemDisplay}
            />
        </div>
    )
}
