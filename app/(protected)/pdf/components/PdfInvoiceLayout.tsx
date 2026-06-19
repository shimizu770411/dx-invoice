import { Fragment, RefObject } from 'react'
import { PdfCompanyAd } from './PdfCompanyAd'
import { PdfMembershipTable } from './PdfMembershipTable'
import { resolveProductImageUrl } from '@/lib/utils'
import { scopeApplies } from '@/lib/productScope'

export type PdfProductItem = {
    id: string
    name: string
    isSetParent?: boolean
}

export type PdfDocumentItem = {
    id?: string
    productItemId?: string
    productVariantId?: string | null
    productItem?: {
        name?: string
        isSetChild?: boolean
        serviceableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        setableScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
        isMaturityServiceable?: boolean
    } | null
    productVariant?: { name?: string; imageUrl?: string | null; isDefaultSet?: boolean; setPrice?: number } | null
    description?: string | null
    qty: number
    unitPriceGeneral: number
    unitPriceMember: number
    amount: number
    isService?: boolean
    isMaturityService?: boolean
    sortNo: number
}

export type PdfMembership = {
    memberNo?: string | null
    memberName?: string | null
    courseUnits?: number | null
    maturityAmount?: number | null
    paymentTimes?: number | null
    paymentAmount?: number | null
    paymentAmountOnce?: number | null
    salesStaffName?: string | null
    relationToDeceased?: string | null
}

export type PdfDocumentCustomer = {
    deceasedName?: string
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | null
    age?: number | null
    receptionAt?: string | Date | null
    chiefMournerName?: string
    chiefMournerTel?: string
    chiefMournerAddress?: string
    chiefMournerRelation?: string | null
    payerName?: string | null
    payerRelation?: string | null
    payerAddress?: string | null
    payerTel?: string | null
    pickupPlace?: string | null
    wakeAt?: string | Date | null
    wakePlace?: string | null
    departureAt?: string | Date | null
    departurePlace?: string | null
    funeralFrom?: string | Date | null
    funeralTo?: string | Date | null
    funeralPlace?: string | null
    returnAt?: string | Date | null
    returnPlace?: string | null
    religion?: string | null
    memberCardNote?: string | null
    notes?: string | null
    cremationProcessType?: string | null
    altarPlaceType?: string | null
    altarPlaceOther?: string | null
    ceilingHeight?: string | number | null
    estimateStaff?: string | null
    ceremonyStaff?: string | null
    transportStaff?: string | null
    decorationStaff?: string | null
    returnStaff?: string | null
    memberships?: PdfMembership[]
}

const genderLabel: Record<string, string> = {
    MALE: '男',
    FEMALE: '女',
    OTHER: '--',
}

export type PdfFreeItem = {
    id?: string
    productItemName: string
    description?: string | null
    unitPriceGeneral: number
    qty: number
    amount: number
    sortNo: number
}

export type PdfDocument = {
    docNo?: string | null
    isMember?: boolean | null
    subtotal: number
    tax: number
    total: number
    membershipPaidAmount: number
    grandTotal: number
    items: PdfDocumentItem[]
    freeItems?: PdfFreeItem[]
    customer?: PdfDocumentCustomer | null
}

type Props = {
    contentId: string
    containerRef?: RefObject<HTMLDivElement | null>
    title: string
    document: PdfDocument
    products: PdfProductItem[]
    hideSelectedOptions?: boolean
}

// ──────────────────────────────────────────────────────────
// テーブル行ビルダー
// ──────────────────────────────────────────────────────────
type DisplayRow = {
    label: string
    estimateItem?: PdfDocumentItem | null
    showProductVariantName: boolean // 霊柩車のように、品名の下に商品詳細を表示するかどうか
    isFreeItem?: boolean // フリー項目（商品マスタ非連動）の場合に単価を表示
    isMaturity?: boolean // 満期サービス（固定行）。qty=1なので単価表示はスキップ
    isFixedRow?: boolean // 満期サービス・解約手数料など固定行（単価表示スキップ）
    deductionLabel?: string
    deductionItem?: PdfDocumentItem | null
}

function buildDisplayRows(
    products: PdfProductItem[],
    items: PdfDocumentItem[],
    freeItems?: PdfFreeItem[]
): DisplayRow[] {
    // 実際に選択された明細だけを商品マスタの順に表示
    // 未選択（qty=0 またはマスタに存在しても明細にない）商品は非表示
    const selectedByProductId = new Map<string, PdfDocumentItem>()
    for (const item of items) {
        if ((item.qty ?? 0) <= 0) continue
        const pid = item.productItemId ?? ''
        if (pid && !selectedByProductId.has(pid)) {
            selectedByProductId.set(pid, item)
        }
    }

    const rows: DisplayRow[] = []

    // 商品マスタの並び順で表示。
    // 未選択商品も品名のみ表示（金額は空欄）、ただし親セットは非表示。
    for (const product of products) {
        const estimateItem = selectedByProductId.get(product.id)
        if (!estimateItem) {
            if (product.isSetParent) continue
            rows.push({
                label: product.name,
                estimateItem: null,
                showProductVariantName: false,
            })
            continue
        }
        rows.push({
            label: product.name,
            estimateItem,
            showProductVariantName: product.name.includes('霊柩車') ? true : false,
        })
    }

    // フリー項目（数量>0のみ）を末尾に追加
    // 解約手数料は明細には表示せず、合計欄で別行扱いにする
    for (const fi of freeItems ?? []) {
        if ((fi.qty ?? 0) <= 0) continue
        if (fi.productItemName === '解約手数料') continue
        const isMaturity = fi.productItemName === '満期サービス'
        const isCancellationFee = false
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
            isFixedRow: isMaturity || isCancellationFee,
        })
    }

    return rows
}

// ──────────────────────────────────────────────────────────
// 選択肢ラベルマップ
// ──────────────────────────────────────────────────────────
const CREMATION_LABEL: Record<string, string> = {
    FAMILY: '喪家',
    NEIGHBORHOOD: '隣組',
    COMPANY: '自社代行',
}

const ALTAR_LABEL: Record<string, string> = {
    HOME: '自宅',
    FUNERAL_HALL: '斎場',
    OTHER: 'その他',
}

// ──────────────────────────────────────────────────────────
// 日付フォーマットヘルパー
// ──────────────────────────────────────────────────────────
function fmtDate(v?: string | Date | null): string {
    if (!v) return ''
    const d = new Date(v)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}年${mm}月${dd}日`
}

function fmtTime(v?: string | Date | null): string {
    if (!v) return ''
    const d = new Date(v)
    return `${String(d.getHours()).padStart(2, '0')}時${String(d.getMinutes()).padStart(2, '0')}分`
}

// 金額フォーマッタ。負値は会計表記に合わせて「▲ 1,234」のように出力する。
function fmtAmount(n: number): string {
    if (n < 0) return `▲${Math.abs(n).toLocaleString()}`
    return n.toLocaleString()
}

export function PdfInvoiceLayout({ contentId, containerRef, title, document: doc, products, hideSelectedOptions }: Props) {
    const { docNo, membershipPaidAmount, items } = doc
    const docAny = doc as any
    const isMember = doc.isMember === true
    // DB保存値ではなく実際のitems/freeItemsから合計を再計算
    // 解約手数料: qty>0 で登録されていれば、合計欄に「解約手数料」「値引」の2行を表示。
    // 解約手数料は小計に含めない（消費税対象外）。値引で相殺するため差引合計にも影響しない。
    const cancellationFee = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName === '解約手数料' && (fi.qty ?? 0) > 0)
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const showCancellationFee = cancellationFee >= 1
    // フリー項目の小計（解約手数料を除く）
    const freeSubtotal = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName !== '解約手数料')
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    // 列ごとに「セット」「サービス」として 0 円扱いか判定するヘルパー
    const isSetIncludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        !!(
            item.productItem?.isSetChild &&
            item.productVariant?.isDefaultSet &&
            scopeApplies(item.productItem?.setableScope, isMember)
        )
    const isServiceIncludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        !!(item.isService && scopeApplies(item.productItem?.serviceableScope, isMember))
    const isMaturityServiceIncludedFor = (item: PdfDocumentItem): boolean =>
        !!(item.isMaturityService && item.productItem?.isMaturityServiceable)
    const isExcludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        isSetIncludedFor(item, isMember) ||
        isServiceIncludedFor(item, isMember) ||
        (isMaturityServiceIncludedFor(item) && isMember)

    // 会員価格（セット扱い / サービス扱いの行は除外）
    const itemsMemberSubtotal = items.reduce((sum, item) => {
        if (isExcludedFor(item, true)) return sum
        return sum + (item.unitPriceMember * item.qty || 0)
    }, 0)
    const memberSubtotal = itemsMemberSubtotal + freeSubtotal
    const memberTax = Math.floor(memberSubtotal * 0.1) // 消費税は10%で固定、端数は切り捨て
    const memberTotal = memberSubtotal + memberTax
    // 一般価格（一般モード時に該当する行のみ除外）
    const itemsGeneralSubtotal = items.reduce((sum, item) => {
        if (isExcludedFor(item, false)) return sum
        return sum + (item.unitPriceGeneral * item.qty || 0)
    }, 0)
    const generalSubtotal = itemsGeneralSubtotal + freeSubtotal
    const generalTax = Math.floor(generalSubtotal * 0.1)
    const generalTotal = generalSubtotal + generalTax
    // 差引合計: 解約手数料と値引（=解約手数料×-1）が相殺されるため、解約手数料分の影響は無い。
    // 会費入金額は互助会員のみ持つ事前積立なので、会員価格列のみ控除する。一般価格列は控除しない。
    const generalGrandTotal = Math.max(0, generalTotal)
    const memberGrandTotal = Math.max(0, memberTotal - membershipPaidAmount)
    const customer: PdfDocumentCustomer | undefined = docAny.customer
        ? {
              ...docAny.customer,
              cremationProcessType: docAny.cremationProcessType ?? null,
              altarPlaceType: docAny.altarPlaceType ?? null,
              altarPlaceOther: docAny.altarPlaceOther ?? null,
              ceilingHeight: docAny.ceilingHeight ?? null,
              estimateStaff: docAny.estimateStaff ?? null,
              ceremonyStaff: docAny.ceremonyStaff ?? null,
              transportStaff: docAny.transportStaff ?? null,
              decorationStaff: docAny.decorationStaff ?? null,
              returnStaff: docAny.returnStaff ?? null,
          }
        : undefined
    const displayRows = buildDisplayRows(products, items, doc.freeItems)
    const notesLong = (customer?.notes?.length ?? 0) >= 20
    return (
        <div
            id={contentId}
            ref={containerRef}
            className="bg-white text-black"
            style={{ fontFamily: '"Noto Serif JP", serif' }}
        >
            {/* 外枠 */}
            <div className="border-2 border-black">
                {/* タイトル */}
                <div className="grid grid-cols-[1fr_2fr_171.5px] items-end border-b-2 border-black px-2 py-1">
                    <div>&nbsp;</div>
                    <h1 className="text-center text-4xl font-black leading-[1] tracking-widest">{title}</h1>
                    <div className="flex justify-end">
                        <div className="whitespace-nowrap border-b border-black pb-[2px] align-bottom text-[0.8rem] leading-none tracking-tight">
                            受付No.{docNo ? ` ${docNo}` : ''}
                        </div>
                    </div>
                </div>

                {/* 故人情報 */}
                <div className="border-b-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr_171.5px] items-center px-2 py-1">
                        <div>&nbsp;</div>
                        <div className="text-center">
                            <div className="inline-block border-b border-black pb-[4px] align-bottom text-3xl font-black leading-none tracking-wide">
                                故　
                                <span className="px-3">{customer?.deceasedName || ''}</span>
                                　様
                            </div>
                        </div>
                        <div className="ml-1 flex justify-start">
                            <div className="whitespace-nowrap text-[0.8rem] leading-[1] tracking-tight">
                                ({customer?.gender ? (genderLabel[customer.gender] ?? '') : ''}) &nbsp; 行年 &nbsp;
                                {customer?.age ?? ''}
                                &nbsp; 才
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-[2.8fr_1.2fr] gap-4 px-3 py-1 text-[0.8rem] leading-[1] tracking-tight">
                        <div className="flex w-[28rem] justify-between">
                            <div>告別式</div>
                            {/* 年 */}
                            <div>
                                {customer?.funeralFrom ? new Date(customer.funeralFrom).getFullYear() + '年' : ''}
                            </div>
                            {/* 月 */}
                            <div>
                                {customer?.funeralFrom
                                    ? String(new Date(customer.funeralFrom).getMonth() + 1).padStart(2, '0') + '月'
                                    : ''}
                            </div>
                            {/* 日 */}
                            <div>
                                {customer?.funeralFrom
                                    ? String(new Date(customer.funeralFrom).getDate()).padStart(2, '0') + '日'
                                    : ''}
                            </div>
                            {/* 開始時間 */}
                            <div className="flex gap-1">
                                <div>自</div>
                                <div className="flex border-x-0 border-b border-t-0 border-black">
                                    <div className="ml-4">
                                        {customer?.funeralFrom
                                            ? String(new Date(customer.funeralFrom).getHours()).padStart(2, '0')
                                            : '--'}
                                        &nbsp;時
                                    </div>
                                    <div className="ml-4">
                                        {customer?.funeralFrom
                                            ? String(new Date(customer.funeralFrom).getMinutes()).padStart(2, '0')
                                            : '--'}
                                        &nbsp;分
                                    </div>
                                </div>
                            </div>
                            <div>〜</div>
                            {/* 終了時間 */}
                            <div className="flex gap-1">
                                <div>至</div>
                                <div className="flex border-x-0 border-b border-t-0 border-black">
                                    <div className="ml-4">
                                        {customer?.funeralTo
                                            ? String(new Date(customer.funeralTo).getHours()).padStart(2, '0')
                                            : '--'}
                                        &nbsp;時
                                    </div>
                                    <div className="ml-4">
                                        {customer?.funeralTo
                                            ? String(new Date(customer.funeralTo).getMinutes()).padStart(2, '0')
                                            : '--'}
                                        &nbsp;分
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="border border-x-0 border-t-0 border-black">
                            御宗旨&nbsp;&nbsp;{customer?.religion ?? ''}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between gap-0">
                    {/* 明細ブロック */}
                    <div className="w-[60%] border-r-2 border-black">
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
                                        <div className="mx-auto flex w-[4rem] justify-between">
                                            {'一般価格'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-x-0 border-t-0 border-black px-1 text-center">
                                        <div className="mx-auto flex w-[4rem] justify-between">
                                            {'会員価格'.split('').map((char, i) => (
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
                                                                className={`mx-auto flex w-[6rem] ${chars.length === 1 ? 'justify-center' : 'justify-between'}`}
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
                                                <div>
                                                    {/* 数量が1より大きい場合のみ表示。フリー項目は常に単価も表示 */}
                                                    {row.estimateItem && row.estimateItem.qty > 1
                                                        ? `数量: ${row.estimateItem.qty.toLocaleString()}`
                                                        : ''}
                                                    {row.isFreeItem && !row.isFixedRow && row.estimateItem
                                                        ? `${row.estimateItem.qty > 1 ? '　' : ''}単価: ¥${fmtAmount(row.estimateItem.unitPriceGeneral)}`
                                                        : ''}
                                                </div>
                                            </td>
                                            <td className="border border-black px-1 text-right">
                                                {row.estimateItem ? (
                                                    isServiceIncludedFor(row.estimateItem, false) ? (
                                                        <span style={{ color: '#8a7e5c', fontWeight: 600 }}>
                                                            サービス
                                                        </span>
                                                    ) : isSetIncludedFor(row.estimateItem, false) ? (
                                                        <span style={{ color: '#8a7e5c', fontWeight: 600 }}>
                                                            セット
                                                        </span>
                                                    ) : (
                                                        fmtAmount(
                                                            row.estimateItem.unitPriceGeneral * row.estimateItem.qty
                                                        )
                                                    )
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                            <td className="border border-r-0 border-black px-1 text-right">
                                                {row.estimateItem ? (
                                                    isMaturityServiceIncludedFor(row.estimateItem) ? (
                                                        <span style={{ color: '#8a7e5c', fontWeight: 600 }}>
                                                            満期サービス
                                                        </span>
                                                    ) : isServiceIncludedFor(row.estimateItem, true) ? (
                                                        <span style={{ color: '#8a7e5c', fontWeight: 600 }}>
                                                            サービス
                                                        </span>
                                                    ) : isSetIncludedFor(row.estimateItem, true) ? (
                                                        <span style={{ color: '#8a7e5c', fontWeight: 600 }}>
                                                            セット
                                                        </span>
                                                    ) : (
                                                        fmtAmount(
                                                            row.estimateItem.unitPriceMember *
                                                                row.estimateItem.qty
                                                        )
                                                    )
                                                ) : (
                                                    ''
                                                )}
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
                                    <td className="border border-black px-1 text-right">
                                        {fmtAmount(generalSubtotal)}
                                    </td>
                                    <td className="border border-black border-r-0 px-1 text-right">
                                        {fmtAmount(memberSubtotal)}
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
                                    <td className="border border-black px-1 text-right">
                                        {fmtAmount(generalTax)}
                                    </td>
                                    <td className="border border-black border-r-0 px-1 text-right">
                                        {fmtAmount(memberTax)}
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
                                    <td className="border border-black px-1 text-right">
                                        {fmtAmount(generalTotal)}
                                    </td>
                                    <td className="border border-black border-r-0 px-1 text-right">
                                        {fmtAmount(memberTotal)}
                                    </td>
                                </tr>
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
                                                <td className="border border-black px-1 border-r-0 text-right">
                                                    <span className="mr-1">▲</span>
                                                    {subtotal.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
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
                                            <td className="border border-black px-1 border-r-0 text-right">
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
                                            <td className="border border-black px-1 border-r-0 text-right">
                                                {fmtAmount(-cancellationFee)}
                                            </td>
                                        </tr>
                                    </>
                                )}
                                <tr style={{ fontSize: 'calc(0.75rem + 2pt)' }}>
                                    <th className="border border-t-2 border-l-0 border-black text-center font-bold bg-black text-white">
                                        <div className="mx-auto flex w-[6rem] justify-between">
                                            {'差引合計額'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="border border-t-2 border-black text-center">&nbsp;</td>
                                    <td className="border border-t-2 border-black px-1 text-right font-bold">
                                        {fmtAmount(generalGrandTotal)}
                                    </td>
                                    <td className="border border-t-2 border-black border-r-0 px-1 text-right font-bold">
                                        {fmtAmount(memberGrandTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* 右ブロック */}
                    <div className="flex w-[40%] flex-col text-sm">
                        {/* 故人・関係者情報ブロック */}
                        <table className="w-full border-collapse border-b border-black text-xs">
                            <tbody>
                                {(
                                    [
                                        { label: '御住所', data: customer?.chiefMournerAddress },
                                        { label: '電話', data: customer?.chiefMournerTel },
                                        {
                                            label: '喪主名',
                                            data: customer?.chiefMournerName,
                                            relData: customer?.chiefMournerRelation ?? '',
                                        },
                                        {
                                            label: '御支払者名',
                                            data: customer?.payerName,
                                            relData: customer?.payerRelation ?? '',
                                        },
                                        { label: '支払者住所', data: customer?.payerAddress },
                                        { label: '支払者電話', data: customer?.payerTel },
                                        { label: '引取場所', data: customer?.pickupPlace },
                                    ] as {
                                        label: string
                                        data?: string | null
                                        relData?: string | null
                                    }[]
                                ).map(({ label, data, relData }, i) => (
                                    <tr key={i} className="border-b border-black">
                                        <th
                                            className="w-[5em] border-r border-black p-1 font-normal"
                                            style={{ minWidth: '5em' }}
                                        >
                                            <div className="flex justify-between">
                                                {label.split('').map((char, j) => (
                                                    <span key={j}>{char}</span>
                                                ))}
                                            </div>
                                        </th>
                                        <td className="px-1 py-1.5" colSpan={relData != null ? 1 : 2}>
                                            {data ?? ''}
                                        </td>
                                        {relData != null && (
                                            <td
                                                className="w-[4em] border-l border-black text-center"
                                                style={{ minWidth: '4em' }}
                                            >
                                                <div className="border-b border-black text-[0.65rem]">続　柄</div>
                                                <div>{relData || '-'}</div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* 各日時・場所ブロック */}
                        <div className="border-b border-black p-1">
                            <table className="w-full border-collapse border-0 text-xs">
                                <tbody>
                                    {(
                                        [
                                            {
                                                label: '受付日',
                                                data: `${fmtDate(customer?.receptionAt)} ${fmtTime(customer?.receptionAt)}`,
                                            },
                                            {
                                                label: '本通夜',
                                                data: customer?.wakeAt
                                                    ? `${fmtDate(customer.wakeAt)} ${fmtTime(customer.wakeAt)}〜`
                                                    : '未定',
                                                place: customer?.wakePlace,
                                            },
                                            {
                                                label: '出棺',
                                                data: customer?.departureAt
                                                    ? `${fmtDate(customer.departureAt)} ${fmtTime(customer.departureAt)} 発`
                                                    : '未定',
                                                place: customer?.departurePlace,
                                            },
                                            {
                                                label: '告別式',
                                                data: customer?.funeralFrom
                                                    ? `${fmtDate(customer.funeralFrom)} ${String(new Date(customer.funeralFrom).getHours()).padStart(2, '0')}時〜${customer.funeralTo ? String(new Date(customer.funeralTo).getHours()).padStart(2, '0') + '時' : ''}`
                                                    : '未定',
                                                place: customer?.funeralPlace,
                                            },
                                        ] as {
                                            label: string
                                            data?: string | null
                                            place?: string | null
                                        }[]
                                    ).map(({ label, data, place }, i) => (
                                        <tr key={i}>
                                            <th
                                                className="w-[3em] border-0 border-black py-1 pr-1 font-normal"
                                                style={{ minWidth: '3em' }}
                                            >
                                                <div className="flex justify-between">
                                                    {label.split('').map((char, j) => (
                                                        <span key={j}>{char}</span>
                                                    ))}
                                                </div>
                                            </th>
                                            <td className="border-b border-black p-1">
                                                <div>{data ?? '未定'}</div>
                                                {place !== undefined && (
                                                    <div className="text-xs">(場所: {place ? `${place}` : '---'})</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* 調整 */}
                        <div className="min-h-0 flex-1 overflow-hidden border-b border-black px-1 text-[0.75rem]">
                            <div>(備考)</div>
                            <div className="mx-2">
                                {notesLong ? (
                                    <div>別紙記載</div>
                                ) : customer?.notes ? (
                                    <div className="whitespace-pre-wrap break-words">{customer.notes}</div>
                                ) : null}
                            </div>
                        </div>
                        {/* その他情報 */}
                        <table className="w-full border-collapse border-t border-black text-xs">
                            <tbody>
                                <tr className="border-b border-black">
                                    <th className="w-[8em] border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'火葬許可証手続'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">
                                        {customer?.cremationProcessType
                                            ? (CREMATION_LABEL[customer.cremationProcessType] ??
                                              customer.cremationProcessType)
                                            : ''}
                                    </td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="w-[8em] border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'祭壇設置場所'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">
                                        {customer?.altarPlaceType === 'OTHER'
                                            ? `その他（${customer.altarPlaceOther ?? ''}）`
                                            : customer?.altarPlaceType
                                              ? (ALTAR_LABEL[customer.altarPlaceType] ?? customer.altarPlaceType)
                                              : ''}
                                    </td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'天井高'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">
                                        {customer?.ceilingHeight ? `${customer.ceilingHeight}尺` : ''}
                                    </td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-x border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'搬送担当'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.transportStaff ?? ''}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'見積担当'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1 ">{customer?.estimateStaff ?? ''}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-x border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'飾り担当'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.decorationStaff ?? ''}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'式担当'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.ceremonyStaff ?? ''}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <th className="border-x border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'引上担当'.split('').map((char, j) => (
                                                <span key={j}>{char}</span>
                                            ))}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.returnStaff ?? ''}</td>
                                </tr>
                            </tbody>
                        </table>
                        {/* 企業広告欄: 常に下端に配置 */}
                        <PdfCompanyAd />
                    </div>
                </div>
            </div>

            {/* ２ページ目 */}
            {/* 会員情報ブロック */}
            <div style={notesLong ? { breakBefore: 'page' } : {}}>
                <PdfMembershipTable memberships={customer?.memberships} />
                {/* 備考 */}
                {notesLong && (
                    <div className="mt-2 p-1 border-2 border-black text-[0.75rem]">
                        <div>(備考)</div>
                        <div className="my-1 mx-2">
                            {(customer?.notes ?? '').split('\n').map((line, i) => (
                                <div key={i} className="whitespace-pre-wrap break-words">
                                    {line || '\u00a0'}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 選択オプション画像ページ */}
            {(() => {
                if (hideSelectedOptions) return null
                const selectedWithImage = items.filter(
                    (it) => it.qty > 0 && it.productVariant?.imageUrl
                )
                if (selectedWithImage.length === 0) return null

                return (
                    <div
                        style={{
                            breakBefore: 'page',
                            pageBreakBefore: 'always',
                        }}
                        className="pt-4"
                    >
                        <div className="mb-4 border-b-2 border-black pb-2">
                            <h2 className="text-center text-2xl font-black tracking-[0.3em]">
                                選択オプション一覧
                            </h2>
                            <p className="mt-1 text-center text-xs tracking-widest">
                                Selected Items
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {selectedWithImage.map((it, i) => {
                                const url = resolveProductImageUrl(it.productVariant?.imageUrl) || ''
                                const unitPrice = isMember
                                    ? it.unitPriceMember
                                    : it.unitPriceGeneral
                                return (
                                    <div
                                        key={i}
                                        className="border border-black"
                                        style={{
                                            breakInside: 'avoid',
                                            pageBreakInside: 'avoid',
                                        }}
                                    >
                                        <div
                                            className="flex items-center justify-center border-b border-black"
                                            style={{
                                                width: '100%',
                                                height: '220px',
                                                backgroundColor: '#f7f6f2',
                                                padding: '6px',
                                            }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={url}
                                                alt={it.productVariant?.name ?? ''}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        </div>
                                        <div className="p-2 text-xs">
                                            <div className="flex items-baseline justify-between border-b border-black pb-1 mb-1">
                                                <span className="font-bold tracking-wider">
                                                    {it.productItem?.name ?? ''}
                                                </span>
                                                {it.qty > 1 && (
                                                    <span className="text-[0.7rem]">
                                                        数量: {it.qty.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[0.8rem]">
                                                    {it.productVariant?.name ?? ''}
                                                </span>
                                                <span className="font-bold text-sm">
                                                    ¥{fmtAmount(unitPrice * it.qty)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
