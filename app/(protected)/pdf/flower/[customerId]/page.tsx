'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getBillingTargets, FlowerBillingTarget, getFamilyName } from '@/lib/flowers'
import { getCompanyProfile, CompanyProfile } from '@/lib/company'
import { getCustomer } from '@/lib/customers'
import { CreateButton } from '@/components/button/CreateButton'
import { ResetButton } from '@/components/button/ResetButton'
import { SearchButton } from '@/components/button/SearchButton'
import { handleLoadError, handleOperationError } from '@/lib/errorHandler'
import { PdfCompanyProfile } from '@/app/(protected)/pdf/components/PdfCompanyProfile'
import { useDateFormat } from '@/hooks/useDateFormat'

interface CustomerInfo {
    funeralFrom: string | null
    estimateDisplayName: string | null
    deceasedLastName: string | null
    deceasedName: string
}

export default function FlowerPdfPage() {
    const router = useRouter()
    const params = useParams()
    const customerId = params.customerId as string
    const [loading, setLoading] = useState(true)
    const [targets, setTargets] = useState<FlowerBillingTarget[]>([])
    const [company, setCompany] = useState<CompanyProfile | null>(null)
    const [customer, setCustomer] = useState<CustomerInfo | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const formatDate = useDateFormat()

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId])

    const loadData = async () => {
        try {
            const [flowersData, companyData, customerData] = await Promise.all([
                getBillingTargets(customerId),
                getCompanyProfile(),
                getCustomer(customerId),
            ])
            // 依頼主が1件以上いる請求先のみ表示
            setTargets(flowersData.filter((t) => t.flowers.length > 0))
            setCompany(companyData)
            setCustomer(customerData)
        } catch (error) {
            handleLoadError(error)
        } finally {
            setLoading(false)
        }
    }

    const handleGeneratePDF = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/pdf/flower/${customerId}?download`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `供花領収書_${customerId}_${new Date().toISOString().split('T')[0]}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            handleOperationError(error, 'PDFの生成に失敗しました')
        } finally {
            setGenerating(false)
        }
    }

    const handlePreviewPDF = async () => {
        setGenerating(true)
        try {
            const res = await fetch(`/api/pdf/flower/${customerId}`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            setPdfUrl(url)
        } catch (error) {
            handleOperationError(error, 'PDFの生成に失敗しました')
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return <div className="p-8">読み込み中...</div>
    }

    if (targets.length === 0) {
        return (
            <div className="p-8">
                <p className="mb-4 text-gray-500">依頼主が登録されている請求先がありません</p>
                <ResetButton onClick={() => router.back()}>戻る</ResetButton>
            </div>
        )
    }

    // PDFプレビュー表示
    if (pdfUrl) {
        return (
            <div className="flex h-screen flex-col p-8">
                <div className="mb-4 flex justify-end gap-3">
                    <ResetButton
                        onClick={() => {
                            URL.revokeObjectURL(pdfUrl)
                            setPdfUrl(null)
                        }}
                    >
                        閉じる
                    </ResetButton>
                    <SearchButton isLoading={generating} onClick={handleGeneratePDF}>
                        PDFダウンロード
                    </SearchButton>
                </div>
                <iframe src={pdfUrl} className="h-[calc(100vh-100px)] w-full rounded border border-gray-300" />
            </div>
        )
    }

    const familyName = customer ? getFamilyName(customer) : ''

    return (
        <div className="mx-auto max-w-3xl p-8">
            {generating && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-700" />
                    <p className="text-sm text-gray-600">PDF を生成しています...</p>
                </div>
            )}
            <div className="mb-8 flex justify-end gap-3">
                <SearchButton isLoading={generating} onClick={handlePreviewPDF}>
                    PDFプレビュー
                </SearchButton>
                <CreateButton disabled={generating} onClick={handleGeneratePDF}>
                    {generating ? '生成中...' : 'PDFダウンロード'}
                </CreateButton>
                <ResetButton onClick={() => router.back()}>閉じる</ResetButton>
            </div>

            {/* PDF生成用コンテンツ（Puppeteer がこの id を参照） */}
            <div
                id={'flower-pdf-content'}
                className="bg-white text-black"
                style={{ fontFamily: '"Noto Serif JP", serif' }}
            >
                {targets.map((target, targetIndex) => {
                    const total = target.flowers.reduce((sum: number, f) => sum + f.amount, 0)
                    const tax = Math.round(total * 0.1)
                    const totalWithTax = total + tax
                    const docTitle = '領収証'
                    return (
                        <div
                            key={target.id}
                            className="mt-4"
                            style={{
                                pageBreakAfter: targetIndex < targets.length - 1 ? 'always' : 'auto',
                                marginBottom: targetIndex < targets.length - 1 ? 0 : '3rem',
                            }}
                        >
                            <div className="bg-white px-8 py-8 border border-gray-600" style={{ borderRadius: '8px' }}>
                                <h1
                                    className="flex w-[12rem] justify-between border-b-2 border-black px-2 text-left text-2xl font-bold"
                                    style={{ fontFamily: '"Noto Sans JP", sans-serif', letterSpacing: '-0.1rem' }}
                                >
                                    {docTitle.split('').map((char, i) => (
                                        <span key={i} className="text-center">
                                            {char}
                                        </span>
                                    ))}
                                </h1>
                                <div className="text-right tracking-[0.4em]">
                                    {formatDate(new Date().toISOString())}
                                </div>

                                <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                                    <div className="w-[60%]">
                                        <div className="mb-2 w-[90%]">
                                            <div className="text-bold flex justify-between border-b border-black text-2xl">
                                                <span className="">{target.billToName}</span>
                                                <span>様</span>
                                            </div>
                                        </div>
                                        {/* <div className="flex w-[90%] items-center justify-between border border-black text-3xl"> */}
                                        {/* 金額 */}
                                        <div className="w-[90%] rounded border border-black px-4 py-2">
                                            <div className="flex items-center gap-2 justify-between">
                                                <span className="text-md font-bold">金額</span>
                                                <span className="text-3xl font-black">
                                                    ¥{totalWithTax.toLocaleString()} −
                                                </span>
                                            </div>
                                        </div>
                                        {/* </div> */}
                                    </div>

                                    {/* 会社情報 */}
                                    <div className="w-[40%] text-center">
                                        {company && <PdfCompanyProfile company={company} />}
                                    </div>
                                </div>

                                <div className="flex justify-between gap-0">
                                    {/* 明細ブロック */}
                                    <div className="w-[70%] border-0 border-black">
                                        <table className="w-full border-collapse border text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="w-[12rem] border border-l-0 border-t-0 border-black px-2 text-center">
                                                        <div className="mx-auto flex w-[6rem] justify-between">
                                                            {'品名'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </th>
                                                    <th className="w-[2rem] border border-l-0 border-t-0 border-black px-2 text-center">
                                                        {'数　量'}
                                                    </th>
                                                    <th className="w-[4rem] border border-l-0 border-t-0 border-black px-2 text-center">
                                                        <div className="mx-auto flex w-[4rem] justify-between">
                                                            {'金額'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {target.flowers.map((flower, index) => (
                                                    <tr key={index}>
                                                        <td className="border border-l-0 border-black px-2 py-1 text-left">
                                                            {`${familyName}家　供花代として`}
                                                        </td>
                                                        <td className="border border-l-0 border-black px-2 text-right">
                                                            {'1'}
                                                        </td>
                                                        <td className="border border-l-0 border-black px-2 text-right">
                                                            ¥{flower.amount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {Array.from({ length: Math.max(0, 8 - target.flowers.length) }).map(
                                                    (_, i) => (
                                                        <tr key={`empty-${i}`}>
                                                            <td className="border border-l-0 border-black px-2 py-1">
                                                                &nbsp;
                                                            </td>
                                                            <td className="border border-l-0 border-black px-2">
                                                                &nbsp;
                                                            </td>
                                                            <td className="border border-l-0 border-black px-2">
                                                                &nbsp;
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                            {/* 金額合計 */}
                                            <tfoot className="border-0 border-t-2 border-black">
                                                <tr>
                                                    <th className="border border-l-0 border-black py-1 text-center">
                                                        <div className="mx-auto flex w-[6rem] justify-between">
                                                            {'小計'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </th>
                                                    <td className="border border-black py-1 text-center">&nbsp;</td>
                                                    <td className="border border-black px-2 py-1 text-right">
                                                        ¥{total.toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th className="border border-l-0 border-black py-1 text-center">
                                                        <div className="mx-auto flex w-[6rem] justify-between">
                                                            {'消費税 10%'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </th>
                                                    <td className="border border-black py-1 text-center">&nbsp;</td>
                                                    <td className="border border-black px-2 py-1 text-right">
                                                        ¥{tax.toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {/* 右ブロック */}
                                    <div className="flex w-[30%] flex-col text-sm">
                                        {/* 施行日ブロック */}
                                        <table className="w-full border-collapse border border-black">
                                            <tbody>
                                                <tr className="border-b border-black">
                                                    <th className="border border-l-0 border-t-0 border-black px-2 text-center">
                                                        <div className="mx-auto flex w-[6rem] justify-between">
                                                            {'施行日'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </th>
                                                </tr>
                                                <tr className="border border-black">
                                                    <td className="p-2 text-right tracking-[0.25em]">
                                                        {customer?.funeralFrom ? formatDate(customer.funeralFrom) : '-'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        {/* 備考: 可変エリア */}
                                        <div className="min-h-0 flex-1 overflow-hidden border border-t-0 border-black px-1 text-sm">
                                            <div>備考</div>
                                            <div className="overflow-hidden">
                                                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                                    &nbsp;
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-1 flex justify-start gap-0">
                                    上記金額正にお引き渡しいたしました。
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
