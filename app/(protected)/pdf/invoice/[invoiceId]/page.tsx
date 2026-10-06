'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { getInvoice } from '@/lib/invoices'
import { getProducts } from '@/lib/products'
import { withProductsMissingFromMaster } from '@/lib/documentMissingProducts'
import { getCompanyProfile } from '@/lib/company'
import { DEFAULT_FREE_ITEM_DISPLAY, FreeItemDisplay, toFreeItemDisplay } from '@/lib/pdfFreeItemDisplay'
import { buildBankTransferText } from '@/lib/separateFees'
import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { CreateButton } from '@/components/button/CreateButton'
import { ResetButton } from '@/components/button/ResetButton'
import { toast } from '@/hooks/use-toast'
import { PdfInvoiceLayout, PDF_VIEWPORT_WIDTH_PX } from '@/app/(protected)/pdf/components/PdfInvoiceLayout'

export default function InvoicePdfPage() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const invoiceId = params.invoiceId as string
    const hideSelectedOptions = searchParams.get('showOptions') === 'false'
    const [loading, setLoading] = useState(true)
    const [invoice, setInvoice] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [bankTransferText, setBankTransferText] = useState<string | null>(null)
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
                setBankTransferText(
                    buildBankTransferText({
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

            // プラン別商品設定の内容を商品情報に反映する。取得に失敗しても
            // PDF自体は元データのまま表示できるよう、ここだけ個別にフォールバックする。
            let overriddenProducts = productsData
            try {
                const planId = (invoiceData as any).planId || BASE_PLAN_ID
                const planSettings = await getProductPlanSettings(planId)
                overriddenProducts = applyPlanOverrides(productsData, planSettings)
            } catch (planError) {
                console.error('Failed to apply plan overrides:', planError)
            }

            // 商品マスタから消えた商品（無効化された商品など）の明細もPDFに出るよう、
            // 保存済み明細が参照している商品を商品リストに補う
            overriddenProducts = withProductsMissingFromMaster(overriddenProducts, invoiceData.items || [])

            const overriddenProductMap = new Map(overriddenProducts.map((p) => [p.id, p]))
            const patchedInvoice = {
                ...invoiceData,
                items: (invoiceData.items || []).map((item: any) => {
                    const overridden = item.productItemId ? overriddenProductMap.get(item.productItemId) : undefined
                    if (!overridden) return item
                    // productItem.variants内のisDefaultSet上書きは、明細行が選択中の productVariant 自体にも反映する必要がある
                    const overriddenVariant = item.productVariantId
                        ? overridden.variants?.find((v: any) => v.id === item.productVariantId)
                        : undefined
                    return {
                        ...item,
                        productItem: overridden,
                        productVariant: overriddenVariant ?? item.productVariant,
                    }
                }),
            }

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
                bankTransferText={bankTransferText}
                freeItemDisplay={freeItemDisplay}
            />
        </div>
    )
}
