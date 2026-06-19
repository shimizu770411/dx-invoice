import { Fragment, RefObject, useState, useEffect } from 'react'
import { PdfCompanyProfile } from './PdfCompanyProfile'
import { getCompanyProfile, CompanyProfile } from '@/lib/company'
import type { PdfDocument, PdfDocumentCustomer, PdfProductItem, PdfDocumentItem, PdfFreeItem } from './PdfInvoiceLayout'

export type { PdfDocument, PdfDocumentCustomer }

type DisplayRow = {
    label: string
    estimateItem?: PdfDocumentItem | null
    showProductVariantName: boolean
    isFreeItem?: boolean
    isMaturity?: boolean
    isFixedRow?: boolean
}

function buildDisplayRows(
    products: PdfProductItem[],
    items: PdfDocumentItem[],
    freeItems?: PdfFreeItem[]
): DisplayRow[] {
    const itemByProductId = new Map<string, PdfDocumentItem>()
    for (const item of items) {
        const pid = item.productItemId ?? ''
        if (pid && !itemByProductId.has(pid)) {
            itemByProductId.set(pid, item)
        }
    }
    const rows: DisplayRow[] = []
    for (const product of products) {
        const estimateItem = itemByProductId.get(product.id) ?? null
        // 未選択の親セットは非表示
        if (!estimateItem && product.isSetParent) continue
        rows.push({
            label: product.name,
            estimateItem,
            showProductVariantName: product.name.includes('霊柩車'),
        })
    }
    // フリー項目を末尾に追加
    // 解約手数料は明細には表示せず、合計欄で別行扱いにする
    for (const fi of freeItems ?? []) {
        if (fi.productItemName === '解約手数料') continue
        const isMaturity = fi.productItemName === '満期サービス'
        rows.push({
            label: fi.productItemName,
            estimateItem: {
                description: fi.description ?? null,
                qty: fi.qty,
                unitPriceGeneral: fi.unitPriceGeneral,
                unitPriceMember: fi.unitPriceGeneral,
                amount: fi.amount,
                sortNo: fi.sortNo,
            },
            showProductVariantName: false,
            isFreeItem: true,
            isMaturity,
            isFixedRow: isMaturity,
        })
    }
    return rows
}

type Props = {
    contentId: string
    containerRef?: RefObject<HTMLDivElement | null>
    document: PdfDocument
    products: PdfProductItem[]
}

function fmtDate(v?: string | Date | null): string {
    if (!v) return ''
    const d = new Date(v)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}年${mm}月${dd}日`
}

export function PdfReceiptLayout({ contentId, containerRef, document: doc, products }: Props) {
    const { membershipPaidAmount } = doc
    const docAny = doc as any
    const customer: PdfDocumentCustomer | undefined = docAny.customer ?? undefined

    // 解約手数料: qty>0 で登録されていれば、合計欄に「解約手数料」「値引」の2行を表示。
    // 解約手数料は小計に含めない（消費税対象外）。値引で相殺するため差引合計にも影響しない。
    const cancellationFee = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName === '解約手数料' && (fi.qty ?? 0) > 0)
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const showCancellationFee = cancellationFee >= 1

    // DB保存値ではなく実際のitems/freeItemsから合計を再計算
    const itemsSubtotal = doc.items.reduce((sum, item) => sum + (item.amount || 0), 0)
    // フリー項目の小計（解約手数料を除く）
    const freeSubtotal = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName !== '解約手数料')
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const subtotal = itemsSubtotal + freeSubtotal
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax
    const grandTotal = Math.max(0, total - membershipPaidAmount)

    const addressee = customer?.payerName || customer?.chiefMournerName || ''
    const issuedAt = fmtDate(new Date())
    const displayRows = buildDisplayRows(products, doc.items, doc.freeItems)

    const [company, setCompany] = useState<CompanyProfile | null>(null)
    useEffect(() => {
        getCompanyProfile()
            .then(setCompany)
            .catch(() => {})
    }, [])
    const notesLong = (customer?.notes?.length ?? 0) >= 100

    return (
        <div
            id={contentId}
            ref={containerRef}
            className="bg-white text-black"
            style={{ fontFamily: '"Noto Serif JP", serif' }}
        >
            <div className="border border-[#999] p-4 rounded-lg">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start">
                    {/* 収入印紙欄 */}
                    <div className="px-8 py-2.5 text-center border border-dashed border-black [writing-mode:vertical-rl] justify-self-start">
                        収入印紙
                    </div>
                    {/* タイトル（常に中央） */}
                    <div className="mb-4 flex flex-col items-center gap-1">
                        <h1 className="text-4xl font-black tracking-[0.3em]">領　収　書</h1>
                        <hr className="my-0 w-full border-t-2 border-black" />
                        <div className="tracking-[0.4em]">{issuedAt}</div>
                    </div>
                    {/* 右スペーサー（左右均等のため） */}
                    <div />
                </div>

                <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                    <div className="w-[55%]">
                        {/* 宛名 */}
                        <div className="mb-2 w-[80%]">
                            <div className="text-bold flex justify-between border-b-2 border-black text-2xl">
                                <span className="">{addressee ? `${addressee}` : ''}</span>
                                <span>様</span>
                            </div>
                            <div className="mt-2 text-sm text-gray-700">下記の金額を正に受領いたしました。</div>
                        </div>

                        {/* 金額 */}
                        <div className="rounded border-2 border-black px-4 py-2">
                            <div className="flex items-center gap-2 justify-between">
                                <span className="text-md font-bold">金額</span>
                                <span className="text-3xl font-black">¥{grandTotal.toLocaleString()} −</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-[45%]">
                        {/* 会社情報 */}
                        {company && <PdfCompanyProfile company={company} />}
                    </div>
                </div>

                {/* 明細 + 右ブロック */}
                <div className="flex justify-between gap-0">
                    {/* 明細ブロック */}
                    <div className="w-[70%] border border-black">
                        <table className="w-full border-collapse text-[0.75rem]">
                            <thead>
                                <tr>
                                    <th className="border border-l-0 border-t-0 border-black px-2 text-center">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'品名'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-l-0 border-t-0 border-black text-center">
                                        <div className="mx-auto flex w-[5.5rem] justify-between">
                                            {'摘要'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-l-0 border-t-0 border-black px-1 text-center">
                                        <div className="mx-auto flex w-[2rem] justify-between">
                                            {'数量'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-r-0 border-t-0 border-black px-1 text-center">
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
                                {displayRows.map((row, index) => (
                                    <Fragment key={index}>
                                        <tr key={`main-${index}`}>
                                            <td className="border border-l-0 border-black px-2">
                                                {(() => {
                                                    const chars = (row.label || '-').split('')
                                                    return (
                                                        <>
                                                            <div
                                                                className={`mx-auto flex w-[6rem] ${
                                                                    chars.length === 1
                                                                        ? 'justify-center'
                                                                        : 'justify-between'
                                                                }`}
                                                            >
                                                                {chars.map((char, i) => (
                                                                    <span key={i} className="text-center">
                                                                        {char}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <div className="text-center">
                                                                {row.estimateItem && row.showProductVariantName
                                                                    ? `(${row.estimateItem?.productVariant?.name})`
                                                                    : ''}
                                                            </div>
                                                        </>
                                                    )
                                                })()}
                                            </td>
                                            <td className="border border-l-0 border-black px-0.5 text-left">
                                                <div className="whitespace-pre-wrap break-words">
                                                    {row.estimateItem?.description ?? ''}
                                                </div>
                                                {row.isFreeItem && !row.isFixedRow && row.estimateItem && (
                                                    <div>
                                                        単価: ¥{row.estimateItem.unitPriceGeneral.toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border border-black px-1 text-right">
                                                {row.estimateItem ? `${row.estimateItem.qty.toLocaleString()}` : ''}
                                            </td>
                                            <td className="border border-r-0 border-black px-1 text-right">
                                                {row.estimateItem ? row.estimateItem.amount.toLocaleString() : ''}
                                            </td>
                                        </tr>
                                    </Fragment>
                                ))}
                            </tbody>
                            {/* 金額合計 */}
                            <tfoot className="border-0 border-t-2 border-black">
                                <tr>
                                    <th className="border border-l-0 border-black text-center">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'小計'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="border border-black px-1 text-center">&nbsp;</td>
                                    <td className="border border-black px-1 text-right">&nbsp;</td>
                                    <td className="border border-r-0 border-black px-1 text-right">
                                        {doc.subtotal.toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <th className="border border-l-0 border-black text-center">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'消費税 10%'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="border border-black text-center">&nbsp;</td>
                                    <td className="border border-black px-1 text-right">&nbsp;</td>
                                    <td className="border border-r-0 border-black px-1 text-right">
                                        {doc.tax.toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <th className="border border-l-0 border-black text-center">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'合計'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="border border-black text-center">&nbsp;</td>
                                    <td className="border border-black px-1 text-right">&nbsp;</td>
                                    <td className="border border-r-0 border-black px-1 text-right">
                                        {doc.total.toLocaleString()}
                                    </td>
                                </tr>
                                {showCancellationFee && (
                                    <>
                                        <tr>
                                            <th className="border border-l-0 border-black text-center">
                                                <div className="mx-auto flex w-[6rem] justify-between">
                                                    {'解約手数料'.split('').map((char, i) => (
                                                        <span key={i} className="text-center">
                                                            {char}
                                                        </span>
                                                    ))}
                                                </div>
                                            </th>
                                            <td className="border border-black text-center">&nbsp;</td>
                                            <td className="border border-black px-1 text-right">&nbsp;</td>
                                            <td className="border border-r-0 border-black px-1 text-right">
                                                {cancellationFee.toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th className="border border-l-0 border-black text-center">
                                                <div className="mx-auto flex w-[6rem] justify-between">
                                                    {'値　引'.split('').map((char, i) => (
                                                        <span key={i} className="text-center">
                                                            {char}
                                                        </span>
                                                    ))}
                                                </div>
                                            </th>
                                            <td className="border border-black text-center">&nbsp;</td>
                                            <td className="border border-black px-1 text-right">&nbsp;</td>
                                            <td className="border border-r-0 border-black px-1 text-right">
                                                -{cancellationFee.toLocaleString()}
                                            </td>
                                        </tr>
                                    </>
                                )}
                                {(customer?.memberships ?? [])
                                    .filter((m) => m.paymentAmountOnce != null && m.paymentTimes != null)
                                    .map((m, idx) => {
                                        const subtotal =
                                            (m.paymentAmountOnce ?? 0) * (m.paymentTimes ?? 0)
                                        return (
                                            <tr key={`membership-${idx}`}>
                                                <th className="border border-l-0 border-black text-center">
                                                    {idx === 0 ? (
                                                        <div className="mx-auto flex w-[6rem] justify-between">
                                                            {'会費入金額'.split('').map((char, i) => (
                                                                <span key={i} className="text-center">
                                                                    {char}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <>&nbsp;</>
                                                    )}
                                                </th>
                                                <td className="border border-black text-center">
                                                    {`${(m.paymentAmountOnce ?? 0).toLocaleString()}円×${m.paymentTimes ?? 0}回`}
                                                </td>
                                                <td className="border border-black px-1 text-left">&nbsp;</td>
                                                <td className="border border-r-0 border-black px-1 text-right">
                                                    <span className="mr-1">△</span>
                                                    {subtotal.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tfoot>
                        </table>
                        <div className="border border-x-0 border-black px-4 py-1 text-right bg-black text-white">
                            <p className="text-lg font-bold">差引合計: ¥{grandTotal.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* 右ブロック */}
                    <div className="flex w-[30%] flex-col text-sm">
                        <table className="w-full border-collapse border border-black">
                            <tbody>
                                {/* 施行日ブロック */}
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
                                        {fmtDate(customer?.funeralFrom) || '-'}
                                    </td>
                                </tr>
                                {/* 故人名ブロック */}
                                <tr className="border-b border-black">
                                    <th className="border border-l-0 border-t-0 border-black px-2 text-center">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'故人名'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                </tr>
                                <tr className="border border-black">
                                    <td className="p-2 text-right tracking-[0.25em]">
                                        <div className="flex justify-between border-b border-black pb-1 text-sm">
                                            <span>{customer?.deceasedName || ''}</span>
                                            <span>様</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        {/* 備考 */}
                        <div className="min-h-0 flex-1 overflow-hidden border border-t-0 border-black px-1 text-sm">
                            <div>備考</div>
                            <div className="mx-2">
                                {notesLong ? (
                                    <div>別紙記載</div>
                                ) : customer?.notes ? (
                                    <div className="whitespace-pre-wrap break-words">{customer.notes}</div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={notesLong ? { breakBefore: 'page' } : {}}>
                <div className="mt-4 border border-[#999] p-4 rounded-lg">
                    {/* 備考（長すぎる場合） */}
                    <div className="min-h-0 flex-1 overflow-hidden border p-1 border-black px-1 text-sm">
                        <div>(備考)</div>
                        <div className="my-1 mx-2">
                            {(customer?.notes ?? '').split('\n').map((line, i) => (
                                <div key={i} className="whitespace-pre-wrap break-words">
                                    {line || '\u00a0'}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
