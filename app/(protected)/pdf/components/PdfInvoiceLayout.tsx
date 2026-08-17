import { Fragment, RefObject } from 'react'
import { PdfCompanyAd } from './PdfCompanyAd'
import { PdfMembershipTable } from './PdfMembershipTable'
import { resolveProductImageUrl } from '@/lib/utils'
import { scopeApplies } from '@/lib/productScope'
import { computeMultiRowAmount } from '@/lib/expandMultiRow'
import { useDateFormat } from '@/hooks/useDateFormat'

export type PdfProductItem = {
    id: string
    name: string
    isSetParent?: boolean
    canAddFreeRow?: boolean
    isMultiSelect?: boolean
    multiSelectMerge?: boolean
    hasVariantGroups?: boolean
    showProductVariantName?: boolean
    showQtyInDescription?: boolean
    variants?: { id: string; name: string }[]
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
    productVariant?: { name?: string; abbreviatedName?: string | null; unitLabel?: string | null; imageUrl?: string | null; isDefaultSet?: boolean; setPrice?: number } | null
    productRow?: { useForVariantLabel?: boolean; useForDescriptionLabel?: boolean } | null
    productRowVariant?: { label?: string; abbreviatedName?: string | null; unitLabel?: string | null } | null
    description?: string | null
    multiSelectVariantIds?: string | null
    qty: number
    unitPriceGeneral: number
    unitPriceMember: number
    amount: number
    isService?: boolean
    isMaturityService?: boolean
    adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
    productRowId?: string | null
    calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null
    sign?: number | null
    sortNo: number
}

export type PdfMembership = {
    memberNo?: string | null
    joinedAt?: string | Date | null
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
    estimateDisplayName?: string | null
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
    cremationProcessType?: string | null
    altarPlaceType?: string | null
    altarPlaceOther?: string | null
    ceilingHeight?: string | number | null
    preConsultStaff?: string | null
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
    parentProductItemId?: string | null
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
    remarks?: string | null
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
    isMaturity?: boolean // 満期サービス・施行割増券（固定行、明細欄末尾に固定表示）。qty=1なので単価表示はスキップ
    isFixedRow?: boolean // 満期サービス・解約手数料など固定行（単価表示スキップ）
    hideDescription?: boolean // 複数行構成商品の2行目以降は摘要を非表示
    isSecondaryRow?: boolean // 複数行構成商品の2行目以降（品名空・上罫線なし）
    multiRowGroupSize?: number // 複数行構成商品の先頭行のみ設定（rowSpan に使用）
    displayDescription?: string // MERGEDモード複数選択時: 種類名を「、」で連結した表示用文字列
    variantLabelOverride?: string // 複数行構成商品(isMultiRow)の括弧書き用。useForVariantLabel行の選択種類名
    deductionItem?: PdfDocumentItem | null // 複数行構成商品(hasReturn)の返品行。1行目セルに「▲数量 × 単価」を追記表示する
    showQtyInDescription?: boolean // 商品マスタ設定: 摘要欄の末尾に個数を追記表示する（種類も表示する場合は「種類　個数」の順）
    descriptionLabelOverride?: string // useForDescriptionLabel行（isDescriptionLabelRowがtrueの行）自身の選択種類名
    descriptionUnitLabel?: string // 同、選択種類の単位
    descriptionQtyOverride?: number // 同、その行自体の数量（1行目=固定行のqtyと異なるため）
    hasDescriptionLabelRow?: boolean // 商品全体でuseForDescriptionLabel行が存在するか（商品グループ内の全行で共通）。trueの間、摘要セルは1行目にrowSpanせず各行が個別に持つ
    isDescriptionLabelRow?: boolean // この行自体がuseForDescriptionLabel行か（実際に選ばれた種類名・個数をこの行の摘要欄に表示する）
}

function buildDisplayRows(
    products: PdfProductItem[],
    items: PdfDocumentItem[],
    freeItems?: PdfFreeItem[]
): DisplayRow[] {
    // 実際に選択された明細を商品IDごとにグループ化（複数行構成商品も全行保持）
    const itemsByProductId = new Map<string, PdfDocumentItem[]>()
    for (const item of items) {
        if ((item.qty ?? 0) <= 0) continue
        const pid = item.productItemId ?? ''
        if (!pid) continue
        if (!itemsByProductId.has(pid)) {
            itemsByProductId.set(pid, [])
        }
        itemsByProductId.get(pid)!.push(item)
    }

    const rows: DisplayRow[] = []

    // 親付きフリー行を商品IDで引けるよう Map 化
    const linkedFreeByProductId = new Map<string, any>()
    for (const fi of freeItems ?? []) {
        if (fi.parentProductItemId) {
            linkedFreeByProductId.set(String(fi.parentProductItemId), fi)
        }
    }

    // 商品マスタの並び順で表示。複数行構成商品は同一 product から複数行を出す。
    // 未選択商品も品名のみ表示（金額は空欄）、ただし親セットは非表示。
    for (const product of products) {
        const itemsForProduct = itemsByProductId.get(product.id) ?? []
        if (itemsForProduct.length === 0) {
            if (product.isSetParent) continue
            rows.push({
                label: product.name,
                estimateItem: null,
                showProductVariantName: false,
            })
        } else {
            // 複数行構成商品（同じ productItemId の複数行）は、1行目のみ品名を表示し
            // 2行目以降は品名を空にしてセル結合風の見た目にする。
            // EACH モード（isMultiSelect=true, multiSelectMerge=false）は各行に摘要（種類名）を表示する。
            // MERGED モード（isMultiSelect=true, multiSelectMerge=true/null）は1行で種類名を「、」連結表示する。
            const isEachMode = product.isMultiSelect && product.multiSelectMerge === false
            const isMergedMode = product.isMultiSelect && product.multiSelectMerge !== false
            // グループ商品（重箱など、hasVariantGroups）: 品名・摘要セルは1行目に rowSpan 結合されるため、
            // 各行の摘要（選択した種類名）を改行区切りで1行目のセルにまとめて表示する。
            const isVariantGroupMode = !!product.hasVariantGroups
            // 複数行構成商品(isMultiRow)で、商品マスタ側の useForDescriptionLabel=true とした行の
            // 選択種類名（と単位・数量）は、1行目にまとめず「その行自体」の摘要欄に表示する
            // （会葬礼状のように、実際にその種類が選ばれている行に「種類　個数」を出したいケース向け）
            const hasDescriptionLabelRow =
                !isVariantGroupMode &&
                !isMergedMode &&
                itemsForProduct.length > 1 &&
                itemsForProduct.some((it) => it.productRow?.useForDescriptionLabel && it.sign !== -1)
            itemsForProduct.forEach((estimateItem, idx) => {
                const isFirstRow = idx === 0
                let displayDescription: string | undefined
                if (isMergedMode && isFirstRow && estimateItem.multiSelectVariantIds) {
                    try {
                        const ids: string[] = JSON.parse(estimateItem.multiSelectVariantIds)
                        const names = (product.variants || [])
                            .filter((v) => ids.includes(String(v.id)))
                            .map((v) => v.name)
                        if (names.length > 0) displayDescription = names.join('、')
                    } catch { /* ignore */ }
                } else if (isVariantGroupMode && isFirstRow && itemsForProduct.length > 1) {
                    displayDescription = itemsForProduct
                        .map((it) => it.description || '')
                        .filter(Boolean)
                        .join('\n')
                }
                // 複数行構成商品(isMultiRow)は、商品マスタ側で useForVariantLabel=true とした行の
                // 選択種類名を、1行目セルの括弧書き表示に使う（どの行を出すか商品ごとに指定可能にするため）
                let variantLabelOverride: string | undefined
                if (isFirstRow && !isVariantGroupMode && !isMergedMode && itemsForProduct.length > 1) {
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
                    hideDescription: isEachMode ? false : !isFirstRow,
                    isSecondaryRow: !isFirstRow,
                    displayDescription,
                    variantLabelOverride,
                    multiRowGroupSize: isFirstRow && itemsForProduct.length > 1 ? itemsForProduct.length : undefined,
                    deductionItem: isFirstRow ? itemsForProduct.find((it) => it.sign === -1) ?? undefined : undefined,
                    showQtyInDescription: product.showQtyInDescription,
                    hasDescriptionLabelRow,
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

    // フリー項目（数量>0のみ）を末尾に追加
    // 解約手数料は明細には表示せず、合計欄で別行扱いにする
    // 親付きフリー行（parentProductItemId あり）は商品直下で既に表示済みのため除外
    for (const fi of freeItems ?? []) {
        if (fi.parentProductItemId) continue
        if ((fi.qty ?? 0) <= 0) continue
        if (fi.productItemName === '解約手数料') continue
        // 施行割増券は満期サービスと同様に明細欄の最終行（小計の直前）に固定表示する
        const isMaturity = fi.productItemName === '満期サービス' || fi.productItemName === '施行割増券'
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

const MEMBER_CARD_LABEL: Record<string, string> = {
    COLLECTED: '回収済',
    NOT_COLLECTED: '未回収',
    LOST: '紛失',
}

// ──────────────────────────────────────────────────────────
// 日付フォーマットヘルパー
// ──────────────────────────────────────────────────────────
function fmtDate(v?: string | Date | null): string {
    if (!v) return ''
    const d = new Date(v)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}月${dd}日`
}

function fmtTime(v?: string | Date | null): string {
    if (!v) return ''
    const d = new Date(v)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 金額フォーマッタ。負値は会計表記に合わせて「▲ 1,234」のように出力する。
function fmtAmount(n: number): string {
    if (n < 0) return `▲${Math.abs(n).toLocaleString()}`
    return n.toLocaleString()
}

// 故人名の文字数に応じてフォントサイズを縮小し、「故　○○○○　様」欄が枠内で1行に収まるようにする
function getDeceasedNameFontSize(name?: string | null): string {
    const len = (name ?? '').length
    if (len <= 6) return '1.875rem' // text-3xl 相当（通常の氏名）
    if (len <= 9) return '1.5rem' // text-2xl 相当
    if (len <= 12) return '1.25rem' // text-xl 相当
    if (len <= 16) return '1rem' // text-base 相当
    return '0.875rem' // text-sm 相当
}

export function PdfInvoiceLayout({ contentId, containerRef, title, document: doc, products, hideSelectedOptions }: Props) {
    const { docNo, membershipPaidAmount, items } = doc
    const docAny = doc as any
    const formatDate = useDateFormat()
    const isMember = doc.isMember === true
    // DB保存値ではなく実際のitems/freeItemsから合計を再計算
    // 解約手数料: qty>0 で登録されていれば、合計欄に「解約手数料」「値引」の2行を表示。
    // 解約手数料は小計に含めない（消費税対象外）。値引で相殺するため差引合計にも影響しない。
    const cancellationFee = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName === '解約手数料' && (fi.qty ?? 0) > 0)
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const showCancellationFee = cancellationFee >= 1
    // フリー項目の小計（解約手数料を除く）。満期サービス・施行割増券は会員価格のみの割引のため、一般価格には含めない。
    const isMaturityFreeItem = (fi: PdfFreeItem) =>
        fi.productItemName === '満期サービス' || fi.productItemName === '施行割増券'
    const freeSubtotalMember = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName !== '解約手数料')
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const freeSubtotalGeneral = (doc.freeItems ?? [])
        .filter((fi) => fi.productItemName !== '解約手数料' && !isMaturityFreeItem(fi))
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    // 見積/請求書単位の任意セット扱い（adhocSetScope）。
    // 'BOTH' は一般・会員ともにセット、'MEMBER_ONLY' は会員のみ、'GENERAL_ONLY' は一般のみ。
    const isAdhocSetFor = (item: PdfDocumentItem, isMember: boolean): boolean => {
        const scope = (item as any).adhocSetScope
        if (scope === 'BOTH') return true
        if (scope === 'MEMBER_ONLY' && isMember) return true
        if (scope === 'GENERAL_ONLY' && !isMember) return true
        return false
    }
    // 列ごとに「セット」「サービス」として 0 円扱いか判定するヘルパー
    const isSetIncludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        !!(
            (item.productItem?.isSetChild &&
                item.productVariant?.isDefaultSet &&
                scopeApplies(item.productItem?.setableScope, isMember)) ||
            isAdhocSetFor(item, isMember)
        )
    const isServiceIncludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        !!(item.isService && scopeApplies(item.productItem?.serviceableScope, isMember))
    const isMaturityServiceIncludedFor = (item: PdfDocumentItem): boolean =>
        !!(item.isMaturityService && item.productItem?.isMaturityServiceable)
    const isExcludedFor = (item: PdfDocumentItem, isMember: boolean): boolean =>
        isSetIncludedFor(item, isMember) ||
        isServiceIncludedFor(item, isMember) ||
        (isMaturityServiceIncludedFor(item) && isMember)

    // 複数行構成商品（親子セットの加算/返品ペア等）は sign（符号）を考慮して計算する
    const isMultiRowItem = (item: PdfDocumentItem): boolean => !!(item.productRowId && item.calcType)
    const multiRowAmount = (item: PdfDocumentItem, unitPrice: number): number =>
        computeMultiRowAmount({ calcType: item.calcType, sign: item.sign ?? 1, unitPrice, qty: item.qty })

    // 会員価格（セット扱い / サービス扱いの行は除外）
    const itemsMemberSubtotal = items.reduce((sum, item) => {
        if (isExcludedFor(item, true)) return sum
        if (isMultiRowItem(item)) return sum + multiRowAmount(item, item.unitPriceMember)
        return sum + (item.unitPriceMember * item.qty || 0)
    }, 0)
    const memberSubtotal = itemsMemberSubtotal + freeSubtotalMember
    const memberTax = Math.floor(memberSubtotal * 0.1) // 消費税は10%で固定、端数は切り捨て
    const memberTotal = memberSubtotal + memberTax
    // 一般価格（一般モード時に該当する行のみ除外）
    const itemsGeneralSubtotal = items.reduce((sum, item) => {
        if (isExcludedFor(item, false)) return sum
        if (isMultiRowItem(item)) return sum + multiRowAmount(item, item.unitPriceGeneral)
        return sum + (item.unitPriceGeneral * item.qty || 0)
    }, 0)
    const generalSubtotal = itemsGeneralSubtotal + freeSubtotalGeneral
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
              preConsultStaff: docAny.preConsultStaff ?? null,
              estimateStaff: docAny.estimateStaff ?? null,
              ceremonyStaff: docAny.ceremonyStaff ?? null,
              transportStaff: docAny.transportStaff ?? null,
              decorationStaff: docAny.decorationStaff ?? null,
              returnStaff: docAny.returnStaff ?? null,
          }
        : undefined
    const FIXED_ITEM_ROWS = 36
    const displayRows = buildDisplayRows(products, items, doc.freeItems)
    // 満期サービス行は商品行群の直後ではなく、明細欄の最終行（小計の直前）に固定表示する
    const normalRows = displayRows.filter((row) => !row.isMaturity)
    const maturityRows = displayRows.filter((row) => row.isMaturity)
    const renderItemRow = (row: DisplayRow, index: number, rows: DisplayRow[], keyPrefix: string) => {
        const isNextSecondary = rows[index + 1]?.isSecondaryRow
        const mergeCls = `${row.isSecondaryRow ? 'border-t-0' : ''} ${isNextSecondary ? 'border-b-0' : ''}`
        return (
        <Fragment key={`${keyPrefix}-${index}`}>
            <tr key={`${keyPrefix}-main-${index}`}>
                {!row.isSecondaryRow && (
                <td
                    className="border border-l-0 border-black px-2 align-top"
                    rowSpan={row.multiRowGroupSize}
                >
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
                )}
                {(!row.isSecondaryRow || row.hasDescriptionLabelRow) && (
                <td
                    className={`border border-l-0 border-black px-0.5 text-left align-top ${row.hasDescriptionLabelRow ? mergeCls : ''}`}
                    rowSpan={row.hasDescriptionLabelRow ? 1 : row.multiRowGroupSize}
                >
                    <div className="whitespace-pre-wrap break-words">
                        {!row.isSecondaryRow ? (row.displayDescription ?? row.estimateItem?.description ?? '') : ''}
                        {/* 複数行構成商品: useForDescriptionLabel行(この行自体)の選択種類名を摘要欄に追記 */}
                        {row.isDescriptionLabelRow ? (row.descriptionLabelOverride ?? '') : ''}
                        {/* 商品マスタ設定: 摘要欄末尾に個数(+単位)を追記（種類も表示する場合は「種類　個数」の順） */}
                        {row.isDescriptionLabelRow && row.showQtyInDescription && row.descriptionQtyOverride
                            ? `　${row.descriptionQtyOverride.toLocaleString()}${row.descriptionUnitLabel ?? ''}`
                            : !row.hasDescriptionLabelRow && !row.isSecondaryRow && row.showQtyInDescription && row.estimateItem?.qty
                            ? `　${row.estimateItem.qty.toLocaleString()}${row.estimateItem?.productVariant?.unitLabel ?? ''}`
                            : ''}
                    </div>
                    {!row.isSecondaryRow && (
                    <div className="whitespace-pre-wrap">
                        {/* 複数行構成商品(単価×数量型)は「数量 × 単価」を表示。それ以外は数量が1より大きい場合のみ表示。親付きフリー行（満期サービス以外）は qty=1 でも常に数量を表示。 */}
                        {row.estimateItem && isMultiRowItem(row.estimateItem) && row.estimateItem.calcType === 'UNIT_PRICE_X_QTY'
                            ? `${row.estimateItem.qty.toLocaleString()} × ¥${fmtAmount(isMember ? row.estimateItem.unitPriceMember : row.estimateItem.unitPriceGeneral)}`
                            : row.estimateItem &&
                              (row.estimateItem.qty > 1 ||
                                  (row.isFreeItem && row.isFixedRow && !row.isMaturity))
                            ? `数量: ${row.estimateItem.qty.toLocaleString()}`
                            : ''}
                        {/* 複数行構成商品(hasReturn)の返品行。数量>0のときのみ「▲数量 × 単価」を2行目に追記する */}
                        {row.deductionItem && (row.deductionItem.qty ?? 0) > 0
                            ? `\n▲${row.deductionItem.qty.toLocaleString()} × ¥${fmtAmount(isMember ? row.deductionItem.unitPriceMember : row.deductionItem.unitPriceGeneral)}`
                            : ''}
                        {row.isFreeItem && !row.isFixedRow && row.estimateItem
                            ? `${row.estimateItem.qty > 1 ? '　' : ''}単価: ¥${fmtAmount(row.estimateItem.unitPriceGeneral)}`
                            : ''}
                    </div>
                    )}
                </td>
                )}
                <td
                    className={`border border-black px-1 text-right ${mergeCls}`}
                >
                    {row.estimateItem && !row.isMaturity ? (
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
                                isMultiRowItem(row.estimateItem)
                                    ? multiRowAmount(row.estimateItem, row.estimateItem.unitPriceGeneral)
                                    : row.estimateItem.unitPriceGeneral * row.estimateItem.qty
                            )
                        )
                    ) : (
                        ''
                    )}
                </td>
                <td
                    className={`border border-r-0 border-black px-1 text-right ${mergeCls}`}
                >
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
                                isMultiRowItem(row.estimateItem)
                                    ? multiRowAmount(row.estimateItem, row.estimateItem.unitPriceMember)
                                    : row.estimateItem.unitPriceMember * row.estimateItem.qty
                            )
                        )
                    ) : (
                        ''
                    )}
                </td>
            </tr>
        </Fragment>
        )
    }
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
                    <h1 className="text-center text-4xl font-black leading-[1] tracking-widest whitespace-nowrap">
                        {customer?.estimateDisplayName ?? ''}{title}
                    </h1>
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
                            <div
                                className="inline-block whitespace-nowrap border-b border-black pb-[4px] align-bottom font-black leading-none tracking-wide"
                                style={{ fontSize: getDeceasedNameFontSize(customer?.deceasedName) }}
                            >
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
                            {/* 年月日 */}
                            <div>{customer?.funeralFrom ? formatDate(customer.funeralFrom) : ''}</div>
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
                            <colgroup>
                                <col style={{ width: '24%' }} />
                                <col />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '18%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className="border border-l-0 border-t-0 border-black px-2 text-center">
                                        <div className="mx-auto flex w-[4rem] justify-between">
                                            {'品名'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-l-0 border-t-0 border-black text-center">
                                        <div className="mx-auto flex w-[4rem] justify-between">
                                            {'摘要'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-l-0 border-t-0 border-black px-1 text-center">
                                        <div className="mx-auto flex w-[3rem] justify-between">
                                            {'一般価格'.split('').map((char, i) => (
                                                <span key={i} className="text-center">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </th>
                                    <th className="border border-x-0 border-t-0 border-black px-1 text-center">
                                        <div className="mx-auto flex w-[3rem] justify-between">
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
                                {(() => {
                                    const displayedMemberships = (customer?.memberships ?? [])
                                        .map((m, originalIdx) => ({ m, originalIdx }))
                                        // けやき（3行目）は「1回の入金額×回数」ではなく入金額を直接入力する仕様のため、判定を分ける
                                        .filter(({ m, originalIdx }) =>
                                            originalIdx === 2
                                                ? m.paymentAmount != null
                                                : m.paymentAmountOnce != null && m.paymentTimes != null
                                        )
                                    return displayedMemberships.map(({ m, originalIdx }, idx) => {
                                        const isKeyaki = originalIdx === 2
                                        const subtotal = isKeyaki
                                            ? m.paymentAmount ?? 0
                                            : (m.paymentAmountOnce ?? 0) * (m.paymentTimes ?? 0)
                                        // 「会費入金額」ラベル列（品名列）のみ、複数行にわたる場合の行間境界線を消して1ブロックに見せる。
                                        // border-collapse下では隣接セルの border-bottom/border-top が競合表示されるため両方消す
                                        const isLast = idx === displayedMemberships.length - 1
                                        const labelBorderCls = `${idx > 0 ? 'border-t-0' : ''} ${!isLast ? 'border-b-0' : ''}`
                                        return (
                                            <tr key={`membership-${originalIdx}`}>
                                                <th className={`border border-l-0 border-black text-center ${labelBorderCls}`}>
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
                                                    {isKeyaki
                                                        ? 'けやき入金額'
                                                        : `${(m.paymentAmountOnce ?? 0).toLocaleString()}円×${m.paymentTimes ?? 0}回`}
                                                </td>
                                                <td className="border border-black px-1 text-left">&nbsp;</td>
                                                <td className="border border-black px-1 border-r-0 text-right">
                                                    <span className="mr-1">▲</span>
                                                    {subtotal.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })
                                })()}
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
                                                placeTemplate: '（　場　所　）',
                                            },
                                            {
                                                label: '本通夜',
                                                data: customer?.wakeAt
                                                    ? (customer as any)?.wakeAtTimeUnspecified
                                                        ? `${fmtDate(customer.wakeAt)}`
                                                        : `${fmtDate(customer.wakeAt)} ${fmtTime(customer.wakeAt)}〜`
                                                    : '未定',
                                                place: customer?.wakePlace,
                                            },
                                            {
                                                label: '出棺',
                                                data: customer?.departureAt
                                                    ? (customer as any)?.departureAtTimeUnspecified
                                                        ? `${fmtDate(customer.departureAt)} 発`
                                                        : `${fmtDate(customer.departureAt)} ${fmtTime(customer.departureAt)} 発`
                                                    : '未定',
                                                place: customer?.departurePlace,
                                            },
                                            {
                                                label: '告別式',
                                                data: customer?.funeralFrom
                                                    ? `${fmtDate(customer.funeralFrom)} ${fmtTime(customer.funeralFrom)}〜${customer.funeralTo ? fmtTime(customer.funeralTo) : ''}`
                                                    : '未定',
                                                place: customer?.funeralPlace,
                                            },
                                            {
                                                label: '引上日',
                                                data: customer?.returnAt
                                                    ? `${fmtDate(customer.returnAt)} ${fmtTime(customer.returnAt)}`
                                                    : '',
                                                place: customer?.returnPlace,
                                            },
                                        ] as {
                                            label: string
                                            data?: string | null
                                            place?: string | null
                                            placeTemplate?: string
                                        }[]
                                    ).map(({ label, data, place, placeTemplate }, i) => (
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
                                                <div className="flex items-baseline justify-between">
                                                    <div>{data ?? ''}</div>
                                                    {(placeTemplate ?? place) !== undefined && (
                                                        <div>{placeTemplate ?? `（${place ?? ''}）`}</div>
                                                    )}
                                                </div>
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
                                {doc.remarks ? (
                                    <div className="whitespace-pre-wrap break-words">{doc.remarks}</div>
                                ) : null}
                            </div>
                        </div>
                        {/* その他情報 */}
                        <table className="w-full border-collapse border-t border-black text-xs">
                            <colgroup>
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '30%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '30%' }} />
                            </colgroup>
                            <tbody>
                                {/* 会員証 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'会員証'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="px-1" colSpan={3}>
                                        {customer?.memberCardNote ? (MEMBER_CARD_LABEL[customer.memberCardNote] ?? '') : ''}
                                    </td>
                                </tr>
                                {/* 火葬許可証手続: 全選択肢を表示、選択中は下線+太字 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal" style={{ fontSize: '0.6rem' }}>
                                        <div className="flex justify-between">
                                            {'火葬許可証手続'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="px-1" colSpan={3}>
                                        {(['FAMILY', 'NEIGHBORHOOD', 'COMPANY'] as const).map((key, i) => (
                                            <Fragment key={key}>
                                                {i > 0 && '・'}
                                                <span className={customer?.cremationProcessType === key ? 'underline font-bold' : ''}>
                                                    {CREMATION_LABEL[key]}
                                                </span>
                                            </Fragment>
                                        ))}
                                    </td>
                                </tr>
                                {/* 祭壇設置場所: 全選択肢を表示、選択中は下線+太字 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal" style={{ fontSize: '0.6rem' }}>
                                        <div className="flex justify-between">
                                            {'祭壇設置場所'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="px-1" colSpan={3}>
                                        <div className="flex items-baseline justify-between">
                                            <div>
                                                {(['HOME', 'FUNERAL_HALL'] as const).map((key, i) => (
                                                    <Fragment key={key}>
                                                        {i > 0 && '・'}
                                                        <span className={customer?.altarPlaceType === key ? 'underline font-bold' : ''}>
                                                            {ALTAR_LABEL[key]}
                                                        </span>
                                                    </Fragment>
                                                ))}
                                                {'・'}
                                                <span className={customer?.altarPlaceType === 'OTHER' ? 'underline font-bold' : ''}>
                                                    その他（{customer?.altarPlaceType === 'OTHER' ? (customer.altarPlaceOther ?? '') : ''}
                                                </span>
                                            </div>
                                            <span>）</span>
                                        </div>
                                    </td>
                                </tr>
                                {/* 天井高 | 搬送担当 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'天井高'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="border-r border-black px-1 text-right">
                                        {customer?.ceilingHeight ?? ''}&nbsp;尺
                                    </td>
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'搬送担当'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.transportStaff ?? ''}</td>
                                </tr>
                                {/* 見積担当 | 飾り担当 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'見積担当'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="border-r border-black px-1">
                                        {title.includes('請求書')
                                            ? (customer?.estimateStaff ?? '')
                                            : docAny.status === 'DRAFT'
                                              ? (customer?.preConsultStaff ?? '')
                                              : (customer?.estimateStaff ?? '')}
                                    </td>
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'飾り担当'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="px-1">{customer?.decorationStaff ?? ''}</td>
                                </tr>
                                {/* 式担当 | 引上担当 */}
                                <tr className="border-b border-black">
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'式担当'.split('').map((char, j) => <span key={j}>{char}</span>)}
                                        </div>
                                    </th>
                                    <td className="border-r border-black px-1">{customer?.ceremonyStaff ?? ''}</td>
                                    <th className="border-r border-black px-1 text-left font-normal">
                                        <div className="flex justify-between">
                                            {'引上担当'.split('').map((char, j) => <span key={j}>{char}</span>)}
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
            {/* 互助会テーブル（差引合計の下・全幅・独立枠） */}
            <PdfMembershipTable memberships={customer?.memberships} formatDate={formatDate} />

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
