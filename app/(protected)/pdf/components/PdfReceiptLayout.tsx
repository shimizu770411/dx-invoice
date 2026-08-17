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
    hideDescription?: boolean
    isSecondaryRow?: boolean
    variantLabelOverride?: string // 複数行構成商品(isMultiRow)の括弧書き用。useForVariantLabel行の選択種類名
    showQtyInDescription?: boolean // 商品マスタ設定: 摘要欄の末尾に個数を追記表示する（種類も表示する場合は「種類　個数」の順）
    descriptionLabelOverride?: string // useForDescriptionLabel行（isDescriptionLabelRowがtrueの行）自身の選択種類名
    descriptionUnitLabel?: string // 同、選択種類の単位
    descriptionQtyOverride?: number // 同、その行自体の数量
    isDescriptionLabelRow?: boolean // この行自体がuseForDescriptionLabel行か（hideDescriptionを解除して摘要を表示する）
}

function buildDisplayRows(
    products: PdfProductItem[],
    items: PdfDocumentItem[],
    freeItems?: PdfFreeItem[]
): DisplayRow[] {
    // 複数行構成商品にも対応：商品IDごとに全 estimateItem を保持
    const itemsByProductId = new Map<string, PdfDocumentItem[]>()
    for (const item of items) {
        const pid = item.productItemId ?? ''
        if (!pid) continue
        if (!itemsByProductId.has(pid)) {
            itemsByProductId.set(pid, [])
        }
        itemsByProductId.get(pid)!.push(item)
    }
    // 親付きフリー行を商品IDで引けるよう Map 化
    const linkedFreeByProductId = new Map<string, PdfFreeItem>()
    for (const fi of freeItems ?? []) {
        if (fi.parentProductItemId) {
            linkedFreeByProductId.set(String(fi.parentProductItemId), fi)
        }
    }

    const rows: DisplayRow[] = []
    for (const product of products) {
        const itemsForProduct = itemsByProductId.get(product.id) ?? []
        if (itemsForProduct.length === 0) {
            // 未選択の親セットは非表示
            if (product.isSetParent) continue
            rows.push({
                label: product.name,
                estimateItem: null,
                showProductVariantName: !!product.showProductVariantName,
            })
        } else {
            // 複数行構成商品（同じ productItemId の複数行）は、1行目のみ品名と摘要を表示
            // ただし useForDescriptionLabel=true の行は、実際にその種類が選ばれた行自体に摘要を表示する
            const hasDescriptionLabelRow =
                itemsForProduct.length > 1 &&
                itemsForProduct.some((it) => it.productRow?.useForDescriptionLabel && it.sign !== -1)
            itemsForProduct.forEach((estimateItem, idx) => {
                const isFirstRow = idx === 0
                // 商品マスタ側で useForVariantLabel=true とした行の選択種類名を、1行目の括弧書きに使う
                let variantLabelOverride: string | undefined
                if (isFirstRow && itemsForProduct.length > 1) {
                    const labelSourceItem = itemsForProduct.find((it) => it.productRow?.useForVariantLabel)
                    variantLabelOverride =
                        labelSourceItem?.productVariant?.abbreviatedName ??
                        labelSourceItem?.productRowVariant?.abbreviatedName ??
                        undefined
                }
                const isDescriptionLabelRow =
                    hasDescriptionLabelRow &&
                    !!estimateItem.productRow?.useForDescriptionLabel &&
                    estimateItem.sign !== -1
                rows.push({
                    label: isFirstRow ? product.name : '',
                    estimateItem,
                    showProductVariantName: isFirstRow && !!product.showProductVariantName,
                    hideDescription: !isFirstRow && !isDescriptionLabelRow,
                    isSecondaryRow: !isFirstRow,
                    variantLabelOverride,
                    showQtyInDescription: product.showQtyInDescription,
                    isDescriptionLabelRow,
                    descriptionLabelOverride: isDescriptionLabelRow
                        ? estimateItem.productRowVariant?.label ?? undefined
                        : undefined,
                    descriptionUnitLabel: isDescriptionLabelRow
                        ? estimateItem.productRowVariant?.unitLabel ?? undefined
                        : undefined,
                    descriptionQtyOverride: isDescriptionLabelRow ? estimateItem.qty : undefined,
                })
            })
        }
        // canAddFreeRow=ON の商品はフリー行を直下に追加表示（親商品が選択され、かつ自由入力に品目名または数量の入力がある場合のみ）
        if (product.canAddFreeRow && itemsForProduct.length > 0) {
            const linkedFi = linkedFreeByProductId.get(String(product.id))
            const hasFreeRowContent = !!(linkedFi?.productItemName || (linkedFi?.qty ?? 0) > 0)
            if (hasFreeRowContent) {
                rows.push({
                    label: linkedFi?.productItemName || '　',
                    estimateItem: {
                        description: linkedFi?.description ?? null,
                        qty: linkedFi?.qty ?? 0,
                        unitPriceGeneral: linkedFi?.unitPriceGeneral ?? 0,
                        unitPriceMember: linkedFi?.unitPriceGeneral ?? 0,
                        amount: (linkedFi?.unitPriceGeneral ?? 0) * (linkedFi?.qty ?? 0),
                        sortNo: 9999,
                    } as any,
                    showProductVariantName: false,
                    isFreeItem: true,
                    // 「単価: ¥XX」表示をスキップし、qty>1 のときの「数量: XX」のみ表示させる
                    isFixedRow: true,
                })
            }
        }
    }
    // フリー項目を末尾に追加
    // 解約手数料は明細には表示せず、合計欄で別行扱いにする
    // 親付きフリー行（parentProductItemId あり）は商品直下で既に表示済みのため除外
    for (const fi of freeItems ?? []) {
        if (fi.parentProductItemId) continue
        if (fi.productItemName === '解約手数料') continue
        // 施行割増券は満期サービスと同様に明細欄の最終行（小計の直前）に固定表示する
        const isMaturity = fi.productItemName === '満期サービス' || fi.productItemName === '施行割増券'
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
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}月${dd}日`
}

// 金額フォーマッタ。負値は会計表記に合わせて「▲ 1,234」のように出力する。
function fmtAmount(n: number): string {
    if (n < 0) return `▲${Math.abs(n).toLocaleString()}`
    return n.toLocaleString()
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
    const FIXED_ITEM_ROWS = 37
    const displayRows = buildDisplayRows(products, doc.items, doc.freeItems)
    // 満期サービス行は商品行群の直後ではなく、明細欄の最終行（小計の直前）に固定表示する
    const normalRows = displayRows.filter((row) => !row.isMaturity)
    const maturityRows = displayRows.filter((row) => row.isMaturity)
    const renderItemRow = (row: DisplayRow, index: number, rows: DisplayRow[], keyPrefix: string) => {
        const isNextSecondary = rows[index + 1]?.isSecondaryRow
        const mergeCls = `${row.isSecondaryRow ? 'border-t-0' : ''} ${isNextSecondary ? 'border-b-0' : ''}`
        return (
        <Fragment key={`${keyPrefix}-${index}`}>
            <tr key={`${keyPrefix}-main-${index}`}>
                <td
                    className={`border border-l-0 border-black px-2 ${mergeCls}`}
                >
                    {(() => {
                        const chars = row.isSecondaryRow
                            ? []
                            : (row.label || '-').split('')
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
                                <div className="text-center text-[0.625rem]">
                                    {(() => {
                                        const variantLabel =
                                            row.variantLabelOverride ??
                                            row.estimateItem?.productVariant?.abbreviatedName ??
                                            row.estimateItem?.productRowVariant?.abbreviatedName
                                        return row.estimateItem && row.showProductVariantName && variantLabel
                                            ? `(${variantLabel})`
                                            : ''
                                    })()}
                                </div>
                            </>
                        )
                    })()}
                </td>
                <td
                    className={`border border-l-0 border-black px-0.5 text-left ${mergeCls}`}
                >
                    <div className="whitespace-pre-wrap break-words">
                        {row.hideDescription ? '' : (row.estimateItem?.description ?? '')}
                        {/* 複数行構成商品: useForDescriptionLabel行の選択種類名を摘要欄に追記 */}
                        {!row.hideDescription ? (row.descriptionLabelOverride ?? '') : ''}
                        {/* 商品マスタ設定: 摘要欄末尾に個数(+単位)を追記（種類も表示する場合は「種類　個数」の順） */}
                        {!row.hideDescription &&
                        row.showQtyInDescription &&
                        (row.descriptionQtyOverride ?? row.estimateItem?.qty)
                            ? `　${(row.descriptionQtyOverride ?? row.estimateItem!.qty).toLocaleString()}${row.descriptionUnitLabel ?? row.estimateItem?.productVariant?.unitLabel ?? ''}`
                            : ''}
                    </div>
                    {row.isFreeItem && !row.isFixedRow && row.estimateItem && (
                        <div>
                            単価: ¥{row.estimateItem.unitPriceGeneral.toLocaleString()}
                        </div>
                    )}
                </td>
                <td
                    className={`border border-black px-1 text-right ${mergeCls}`}
                >
                    {row.estimateItem ? `${row.estimateItem.qty.toLocaleString()}` : ''}
                </td>
                <td
                    className={`border border-r-0 border-black px-1 text-right ${mergeCls}`}
                >
                    {row.estimateItem ? fmtAmount(row.estimateItem.amount) : ''}
                </td>
            </tr>
        </Fragment>
        )
    }

    const [company, setCompany] = useState<CompanyProfile | null>(null)
    useEffect(() => {
        getCompanyProfile()
            .then(setCompany)
            .catch(() => {})
    }, [])


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
                                {normalRows.map((row, index) => renderItemRow(row, index, normalRows, 'normal'))}
                                {Array.from({ length: Math.max(0, FIXED_ITEM_ROWS - displayRows.length) }).map((_, i) => (
                                    <tr key={`pad-${i}`}>
                                        <td className="border border-l-0 border-black px-2">&nbsp;</td>
                                        <td className="border border-l-0 border-black px-0.5">&nbsp;</td>
                                        <td className="border border-black px-1">&nbsp;</td>
                                        <td className="border border-r-0 border-black px-1">&nbsp;</td>
                                    </tr>
                                ))}
                                {maturityRows.map((row, index) => renderItemRow(row, index, maturityRows, 'maturity'))}
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
                                                {fmtAmount(-cancellationFee)}
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
                                {doc.remarks ? (
                                    <div className="whitespace-pre-wrap break-words">{doc.remarks}</div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
