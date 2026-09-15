'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getInvoice } from '@/lib/invoices'
import { getProducts } from '@/lib/products'
import { withProductsMissingFromMaster } from '@/lib/documentMissingProducts'
import { toast } from '@/hooks/use-toast'
import { PdfReceiptLayout } from '@/app/(protected)/pdf/components/PdfReceiptLayout'

export default function ReceiptPdfPage() {
    const router = useRouter()
    const params = useParams()
    const invoiceId = params.invoiceId as string
    const [loading, setLoading] = useState(true)
    const [invoice, setInvoice] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceId])

    const loadData = async () => {
        try {
            const [invoiceData, productsData] = await Promise.all([getInvoice(invoiceId), getProducts()])
            setInvoice(invoiceData)
            // 商品マスタから消えた商品（無効化された商品など）の明細も領収書に出るよう、
            // 保存済み明細が参照している商品を商品リストに補う
            setProducts(withProductsMissingFromMaster(productsData, invoiceData.items || []))
        } catch (error) {
            console.error('Failed to load invoice:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleGeneratePDF = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/pdf/receipt/${invoiceId}?download`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `領収書_${invoice?.docNo || invoiceId}_${new Date().toISOString().split('T')[0]}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            toast({ title: 'PDFの生成に失敗しました', variant: 'destructive', duration: 3000 })
        } finally {
            setGenerating(false)
        }
    }


    const btnOutline: React.CSSProperties = {
        padding: '12px 28px',
        backgroundColor: '#ffffff',
        color: 'var(--brand-text-muted)',
        border: '1px solid var(--brand-border)',
        fontSize: '14px',
        letterSpacing: '0.25em',
        fontWeight: 500,
        fontFamily: 'var(--font-mincho)',
        cursor: 'pointer',
        transition: 'all 0.15s',
    }
    const btnPrimary: React.CSSProperties = {
        padding: '12px 36px',
        backgroundColor: 'var(--brand-navy)',
        color: '#ffffff',
        border: 'none',
        fontSize: '14px',
        letterSpacing: '0.3em',
        fontWeight: 500,
        fontFamily: 'var(--font-mincho)',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
        transition: 'all 0.15s',
    }

    if (loading) {
        return (
            <div
                className="p-10"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.15em',
                }}
            >
                読み込み中…
            </div>
        )
    }

    if (!invoice) {
        return (
            <div
                className="p-10"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-red)',
                    letterSpacing: '0.15em',
                }}
            >
                請求書が見つかりません
            </div>
        )
    }

    return (
        <div
            className="px-10 py-8"
            style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}
        >
            {generating && (
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
                    style={{ backgroundColor: 'rgba(251, 250, 247, 0.9)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        className="animate-spin"
                        style={{
                            width: '44px',
                            height: '44px',
                            border: '3px solid var(--brand-border)',
                            borderTopColor: 'var(--brand-navy)',
                            borderRadius: '50%',
                        }}
                    />
                    <p
                        className="font-mincho"
                        style={{
                            fontSize: '14px',
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.15em',
                        }}
                    >
                        PDF を生成しています…
                    </p>
                </div>
            )}

            {/* ページヘッダー */}
            <div
                className="flex items-end justify-between mb-6 pb-5"
                style={{ borderBottom: '1px solid var(--brand-border)' }}
            >
                <div>
                    <p
                        className="font-garamond mb-2"
                        style={{
                            fontSize: '12px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                        }}
                    >
                        RECEIPT
                    </p>
                    <h1
                        className="font-mincho"
                        style={{
                            fontSize: '26px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                            lineHeight: 1.2,
                        }}
                    >
                        領収書発行
                        {invoice.docNo && (
                            <span
                                style={{
                                    fontSize: '16px',
                                    color: 'var(--brand-text-muted)',
                                    fontWeight: 400,
                                    letterSpacing: '0.15em',
                                    marginLeft: '20px',
                                }}
                            >
                                — 請求書 No. {invoice.docNo}
                            </span>
                        )}
                    </h1>
                </div>

            </div>

            {/* 操作ボタン（帳票の左端揃え） */}
            <div className="mx-auto mb-6" style={{ maxWidth: '760px' }}>
                <div className="flex gap-3">
                    <button type="button" style={btnPrimary} disabled={generating} onClick={handleGeneratePDF}>
                        {generating ? '生成中…' : 'PDFダウンロード'}
                    </button>
                    <button type="button" style={btnOutline} onClick={() => router.back()}>
                        閉じる
                    </button>
                </div>
            </div>

            {/* 領収書レイアウト（PDF生成用）*/}
            <div
                className="mx-auto"
                style={{
                    maxWidth: '760px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--brand-border)',
                    padding: '32px',
                    boxShadow: '0 4px 16px rgba(1, 8, 62, 0.06)',
                }}
            >
                <PdfReceiptLayout contentId="receipt-pdf-content" document={invoice} products={products} />
            </div>
        </div>
    )
}
