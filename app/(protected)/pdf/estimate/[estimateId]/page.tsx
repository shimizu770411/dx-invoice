'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { getEstimate } from '@/lib/estimates'
import { getProducts } from '@/lib/products'
import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { CreateButton } from '@/components/button/CreateButton'
import { ResetButton } from '@/components/button/ResetButton'
import { toast } from '@/hooks/use-toast'
import { PdfInvoiceLayout, PDF_VIEWPORT_WIDTH_PX } from '@/app/(protected)/pdf/components/PdfInvoiceLayout'

export default function EstimatePdfPage() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const estimateId = params.estimateId as string
    const hideSelectedOptions = searchParams.get('showOptions') === 'false'
    const [loading, setLoading] = useState(true)
    const [estimate, setEstimate] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estimateId])

    const loadData = async () => {
        try {
            const [estimateData, productsData] = await Promise.all([getEstimate(estimateId), getProducts()])

            // プラン別商品設定の内容を商品情報に反映する。取得に失敗しても
            // PDF自体は元データのまま表示できるよう、ここだけ個別にフォールバックする。
            let overriddenProducts = productsData
            try {
                const planId = (estimateData as any).planId || BASE_PLAN_ID
                const planSettings = await getProductPlanSettings(planId)
                overriddenProducts = applyPlanOverrides(productsData, planSettings)
            } catch (planError) {
                console.error('Failed to apply plan overrides:', planError)
            }

            const overriddenProductMap = new Map(overriddenProducts.map((p) => [p.id, p]))
            const patchedEstimate = {
                ...estimateData,
                items: (estimateData.items || []).map((item: any) => {
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

            setEstimate(patchedEstimate)
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
            const res = await fetch(`/api/pdf/estimate/${estimateId}?download`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `見積書_${estimate?.docNo || estimateId}_${new Date().toISOString().split('T')[0]}.pdf`
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

    if (!estimate) {
        return <div className="p-8">見積が見つかりません</div>
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

            <PdfInvoiceLayout
                contentId="estimate-pdf-content"
                title="家御葬儀見積書"
                document={estimate}
                products={products}
                hideSelectedOptions={hideSelectedOptions}
            />
        </div>
    )
}
