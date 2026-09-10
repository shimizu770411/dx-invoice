'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { getBillingTargets, FlowerBillingTarget, getFamilyName } from '@/lib/flowers'
import { getCompanyProfile, CompanyProfile } from '@/lib/company'
import { getCustomer } from '@/lib/customers'
import { CreateButton } from '@/components/button/CreateButton'
import { ResetButton } from '@/components/button/ResetButton'
import { SearchButton } from '@/components/button/SearchButton'
import { handleLoadError, handleOperationError } from '@/lib/errorHandler'
import { useDateFormat } from '@/hooks/useDateFormat'

/** 明細テーブルの本体（データ行＋空行）の最低行数 */
const ITEM_TABLE_MIN_ROWS = 5

/** 口座種別の1文字略記（振込先ブロックの表示用） */
const BANK_TYPE_ABBREVIATIONS: Record<string, string> = {
    普通: '普',
    当座: '当',
    貯蓄: '貯',
}

interface CustomerInfo {
    funeralFrom: string | null
    estimateDisplayName: string | null
    deceasedLastName: string | null
    deceasedName: string
    receptionNo: string | null
}

/** 告別式日を「月」「日」に分解する。未定の場合は空文字を返す */
function getFuneralMonthDay(funeralFrom: string | null): { month: string; day: string } {
    if (!funeralFrom) return { month: '', day: '' }
    const d = new Date(funeralFrom)
    return { month: String(d.getMonth() + 1), day: String(d.getDate()) }
}

export default function FlowerInvoicePdfPage() {
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
            const res = await fetch(`/api/pdf/flower-invoice/${customerId}?download`)
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `供花請求書_${customerId}_${new Date().toISOString().split('T')[0]}.pdf`
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
            const res = await fetch(`/api/pdf/flower-invoice/${customerId}`)
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
    const { month: funeralMonth, day: funeralDay } = getFuneralMonthDay(customer?.funeralFrom ?? null)

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
                id={'flower-invoice-pdf-content'}
                className="bg-white text-black"
                style={{ fontFamily: '"Noto Serif JP", serif' }}
            >
                {targets.map((target, targetIndex) => {
                    const total = target.flowers.reduce((sum: number, f) => sum + f.amount, 0)
                    const tax = Math.round(total * 0.1)
                    const totalWithTax = total + tax
                    const emptyRowCount = Math.max(0, ITEM_TABLE_MIN_ROWS - target.flowers.length)
                    const bankTypeAbbr = company?.bank2Type
                        ? (BANK_TYPE_ABBREVIATIONS[company.bank2Type] ?? company.bank2Type)
                        : ''

                    return (
                        <div
                            key={target.id}
                            className="mt-4"
                            style={{
                                pageBreakAfter: targetIndex < targets.length - 1 ? 'always' : 'auto',
                                marginBottom: targetIndex < targets.length - 1 ? 0 : '3rem',
                            }}
                        >
                            <div className="bg-white px-10 py-9" style={{ fontWeight: 500 }}>
                                {/* 見出し・宛名・会社情報 */}
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div className="flex flex-col">
                                        <div className="inline-flex w-fit flex-col items-center gap-[0.2rem]">
                                            <div
                                                className="text-[1.8rem] leading-none tracking-[0.8em]"
                                                style={{
                                                    fontWeight: 600,
                                                    marginRight: '-0.8em',
                                                    WebkitTextStroke: '0.5px currentColor',
                                                }}
                                            >
                                                請求書
                                            </div>
                                            <div
                                                style={{
                                                    borderTop: '3px dashed #4a95ab',
                                                    width: 'calc(100% + 0.7rem)',
                                                    margin: '0 -0.35rem',
                                                }}
                                            />
                                        </div>
                                        <div
                                            className="flex w-[21rem] items-baseline justify-between border-b-2 border-black pb-[0.4rem] pl-[2.2rem] text-[1.2rem] leading-none tracking-[0.2em]"
                                            style={{ paddingTop: '4.2rem' }}
                                        >
                                            <span>{target.billToName}</span>
                                            <span className="tracking-[0.1em]">様</span>
                                        </div>
                                    </div>

                                    <div className="relative mt-[0.9rem] flex flex-shrink-0 justify-end">
                                        {company?.sealImageUrl && (
                                            <div
                                                className="absolute h-[3.4rem] w-[3.4rem] overflow-hidden"
                                                style={{ top: '1.6rem', right: '-0.4rem' }}
                                            >
                                                <Image
                                                    src={company.sealImageUrl}
                                                    alt="角印"
                                                    fill
                                                    className="object-contain"
                                                    sizes="80px"
                                                />
                                            </div>
                                        )}
                                        <div
                                            className="whitespace-nowrap text-left text-[0.8rem] leading-[1.55]"
                                            style={{ color: '#2c2d29' }}
                                        >
                                            <div className="mb-[0.6rem]">
                                                発行日　{formatDate(new Date().toISOString())}
                                            </div>
                                            {company?.companyName}
                                            <br />
                                            <span className="text-[0.8rem]">総合葬祭　</span>
                                            <span className="text-[1.1rem] font-bold tracking-[0.5rem]">玉泉院</span>
                                            <br />
                                            {company?.companyAddress}
                                            <br />
                                            TEL　{company?.companyTel}
                                            {company?.companyNo && (
                                                <>
                                                    <br />
                                                    登録番号　{company.companyNo}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 挨拶文 */}
                                <p
                                    className="mx-auto mt-[1.5rem] mb-[1.5rem] w-fit text-left text-[0.85rem] leading-[1.5]"
                                    style={{ color: '#2c2d29' }}
                                >
                                    この度、御供花のご注文を頂き誠に、ありがとうございます。
                                    <br />
                                    下記の通り、御請求申し上げます。
                                </p>

                                {/* 御請求金額 */}
                                <div className="mb-[1.3rem]">
                                    <div className="flex items-baseline gap-2 px-[0.2rem] py-[0.3rem] text-[1.2rem] font-semibold leading-none">
                                        御請求金額　：
                                        <span className="text-[1.2rem] font-semibold tabular-nums">
                                            ¥{totalWithTax.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="h-[3px] border-b border-t border-black" />
                                </div>

                                {/* 明細テーブル */}
                                <table
                                    className="mb-[1.1rem] w-full border-collapse text-[0.8rem] leading-none"
                                    style={{ tableLayout: 'fixed' }}
                                >
                                    <colgroup>
                                        <col style={{ width: '2.1rem' }} />
                                        <col style={{ width: '2.1rem' }} />
                                        <col />
                                        <col style={{ width: '4rem' }} />
                                        <col style={{ width: '5rem' }} />
                                        <col style={{ width: '6rem' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th
                                                colSpan={2}
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                月日
                                            </th>
                                            <th
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                品　名
                                            </th>
                                            <th
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                数量
                                            </th>
                                            <th
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                単価
                                            </th>
                                            <th
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                金額
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {target.flowers.map((flower) => (
                                            <tr key={flower.id}>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-center whitespace-nowrap">
                                                    {funeralMonth}
                                                </td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-center whitespace-nowrap">
                                                    {funeralDay}
                                                </td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-left">
                                                    {familyName}家　供花代として
                                                </td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-center whitespace-nowrap">
                                                    1基
                                                </td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-right tabular-nums">
                                                    {flower.amount.toLocaleString()}
                                                </td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem] text-right font-semibold tabular-nums">
                                                    {flower.amount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {Array.from({ length: emptyRowCount }).map((_, i) => (
                                            <tr key={`empty-${i}`}>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                                <td className="border border-black px-[0.5rem] py-[0.6rem]">&nbsp;</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} className="border-none bg-transparent" />
                                            <th
                                                colSpan={2}
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-semibold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                小　計
                                            </th>
                                            <td className="border border-black px-[0.5rem] py-[0.6rem] text-right tabular-nums">
                                                {total.toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="border-none bg-transparent" />
                                            <th
                                                colSpan={2}
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center font-semibold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                消費税（10%）
                                            </th>
                                            <td className="border border-black px-[0.5rem] py-[0.6rem] text-right tabular-nums">
                                                {tax.toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="border-none bg-transparent" />
                                            <th
                                                colSpan={2}
                                                className="border border-black px-[0.5rem] py-[0.6rem] text-center text-[0.85rem] font-bold"
                                                style={{ backgroundColor: '#f0efe9' }}
                                            >
                                                合　計
                                            </th>
                                            <td className="border border-black px-[0.5rem] py-[0.6rem] text-right text-[0.85rem] font-bold tabular-nums">
                                                {totalWithTax.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* 振込先 */}
                                {company?.bank2Name && (
                                    <div
                                        className="mb-[0.9rem] flex overflow-x-auto border border-black text-[0.8rem]"
                                        style={{ borderRadius: '2px' }}
                                    >
                                        <div
                                            className="flex flex-none items-center whitespace-nowrap border-r border-black px-[0.7rem] py-[0.5rem] font-bold"
                                            style={{ backgroundColor: '#f0efe9' }}
                                        >
                                            振込先
                                        </div>
                                        <div className="flex flex-1 items-center whitespace-nowrap border-r border-black px-[0.7rem] py-[0.5rem]">
                                            {company.bank2Name}
                                            {company.bank2Branch ? `　${company.bank2Branch}` : ''}
                                        </div>
                                        <div className="flex flex-1 items-center whitespace-nowrap border-r border-black px-[0.7rem] py-[0.5rem] tabular-nums">
                                            {bankTypeAbbr && `（${bankTypeAbbr}）`}
                                            {company.bank2Account}
                                        </div>
                                        <div
                                            className="flex flex-none items-center whitespace-nowrap border-r border-black px-[0.7rem] py-[0.5rem] font-bold"
                                            style={{ backgroundColor: '#f0efe9' }}
                                        >
                                            口座名義
                                        </div>
                                        <div className="flex flex-1 items-center whitespace-nowrap px-[0.7rem] py-[0.5rem] font-semibold">
                                            {company.bank2Holder}
                                        </div>
                                    </div>
                                )}

                                {customer?.receptionNo && (
                                    <div
                                        className="mb-1 px-[0.7rem] py-[0.5rem] text-[0.8rem] font-semibold"
                                        style={{
                                            border: '1.5px solid #a3311f',
                                            borderRadius: '3px',
                                            color: '#a3311f',
                                        }}
                                    >
                                        ＊振込名義人欄　前にお客様番号（
                                        <span
                                            className="mx-[0.15em] inline-flex h-[1.6em] min-w-[1.6em] items-center justify-center rounded-full px-[0.3em]"
                                            style={{ border: '1.5px solid #a3311f' }}
                                        >
                                            {customer.receptionNo}
                                        </span>
                                        ）をご入力ください
                                    </div>
                                )}
                                <p className="my-[0.15rem] text-[0.7rem]" style={{ color: '#4a4b46' }}>
                                    ＊振込名義人欄　例　000　○○○○株式会社／氏名
                                </p>
                                <p className="my-[0.15rem] text-[0.7rem]" style={{ color: '#4a4b46' }}>
                                    ※振込手数料についてはお客様ご負担となりますので、予めご了承ください。
                                </p>

                                <div
                                    className="mt-2 px-[0.8rem] py-[0.6rem] text-[0.8rem]"
                                    style={{ border: '1px solid #cfcfc7', borderRadius: '3px', color: '#4a4b46' }}
                                >
                                    誠に恐れ入りますが、振込名が異なる場合、振込が遅れる場合は、
                                    <br />
                                    お手数ですがご一報くださいませ。
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
