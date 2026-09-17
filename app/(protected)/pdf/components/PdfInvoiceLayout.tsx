import { Fragment, RefObject, useState } from 'react'
import { PdfCompanyAd } from './PdfCompanyAd'
import { PdfMembershipTable } from './PdfMembershipTable'
import { AutoFitOneLineText } from './AutoFitOneLineText'
import { resolveProductImageUrl } from '@/lib/utils'
import {
    buildMembershipPaymentRows,
    KEYAKI_ROW_INDEX,
    calcDocumentItemAmount,
    calcFreeItemsSubtotal,
    calcGrandTotal,
    isCancellationFeeRow,
    noChargeReasonFor,
    NO_CHARGE_LABELS,
} from '@/lib/documentTotals'
import { buildSeparateFeesText, buildInvoiceFeeLines, SEPARATE_FEES_BLOCK_END } from '@/lib/separateFees'
import { displayProductItemName, displayProductVariantName } from '@/lib/documentDisplayNames'
import { useDateFormat } from '@/hooks/useDateFormat'
import {
    A4_HEIGHT_MM,
    PX_PER_MM,
    PAGE_BODY_PADDING_PX,
    PDF_VIEWPORT_WIDTH_PX,
    PDF_CONTENT_WIDTH_PX,
} from './pdfLayoutConstants'

export { PDF_VIEWPORT_WIDTH_PX, PDF_CONTENT_WIDTH_PX }

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
    /** 保存時点の商品名・種類名。商品マスタで改名されても発行済み書類の文言を保つための控え */
    productItemName?: string | null
    productVariantName?: string | null
    description?: string | null
    multiSelectVariantIds?: string | null
    qty: number
    unitPriceGeneral: number
    unitPriceMember: number
    amount: number
    isService?: boolean
    isMaturityService?: boolean
    adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
    /** 保存時点で 0 円扱いだったかの控えと、その理由。null / 未設定 は未記録 */
    noChargeScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH' | null
    noChargeReason?: 'SET' | 'SERVICE' | 'MATURITY_SERVICE' | null
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
    returnAtTimeUnspecified?: boolean | null
    returnPlace?: string | null
    religion?: string | null
    memberCardNote?: string | null
    cremationProcessType?: string | null
    altarPlaceType?: string | null
    altarPlaceOther?: string | null
    altarType?: string | null
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
    // 備考欄の【別料金】ブロックに表示する金額（見積のみ）。合計金額には含まれない
    cremationFee?: number | null
    offeringFee?: number | null
    newspaperAdFee?: number | null
    // 備考欄の支払合計ブロックに表示する生花代（請求書のみ）。合計金額には含まれない
    flowerFee?: number | null
    customer?: PdfDocumentCustomer | null
}

type Props = {
    contentId: string
    containerRef?: RefObject<HTMLDivElement | null>
    title: string
    document: PdfDocument
    products: PdfProductItem[]
    hideSelectedOptions?: boolean
    /** 備考欄の冒頭に【別料金】〜【備考】の固定ブロックを出力する（見積書のみ） */
    showSeparateFees?: boolean
    /** 備考欄の冒頭に葬儀代金〜【備考】の固定ブロックを出力する（請求書のみ） */
    showInvoiceFees?: boolean
    /** 備考欄の最下部に出す振込先の1行（請求書のみ）。未登録なら渡さない */
    bankTransferText?: string | null
}

// 支払合計ブロックの罫線の長さ。備考欄の幅いっぱいだと不格好なため、
// 金額が収まる範囲に留める（指示書の図に合わせた比率）
const INVOICE_FEE_BLOCK_WIDTH = '83%'
// 備考欄の文字サイズ（text-[0.75rem] と一致させる）。振込先の自動縮小の基準に使う
const REMARKS_FONT_PX = 12

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
    displayDescriptionLines?: string[] // VARIANT_GROUPモード: 選択した種類名を行ごとに分けたもの。各行を個別にAutoFitOneLineTextで自動縮小・省略対象にする
    isMergedDescription?: boolean // displayDescriptionがMERGEDモード（1行結合、折り返り時は自動縮小対象）か、VARIANT_GROUPモード（意図した複数行）かの判別用
    variantLabelOverride?: string // 複数行構成商品(isMultiRow)の括弧書き用。useForVariantLabel行の選択種類名
    deductionItem?: PdfDocumentItem | null // 複数行構成商品(hasReturn)の返品行。1行目セルに「▲数量 × 単価」を追記表示する
    showQtyInDescription?: boolean // 商品マスタ設定: 摘要欄の末尾に個数を追記表示する（種類も表示する場合は「種類　個数」の順）
    descriptionLabelOverride?: string // useForDescriptionLabel行（isDescriptionLabelRowがtrueの行）自身の選択種類名
    descriptionUnitLabel?: string // 同、選択種類の単位
    descriptionQtyOverride?: number // 同、その行自体の数量（1行目=固定行のqtyと異なるため）
    hasDescriptionLabelRow?: boolean // 商品全体でuseForDescriptionLabel行が存在するか（商品グループ内の全行で共通）。trueの間、摘要セルは1行目にrowSpanせず各行が個別に持つ
    isDescriptionLabelRow?: boolean // この行自体がuseForDescriptionLabel行か（実際に選ばれた種類名・個数をこの行の摘要欄に表示する）
    needsDoubleHeight?: boolean // showProductVariantName有効かつ単一行の商品で、品名の下に種類名を表示する行。中途半端な高さにならないよう明示的に2行分の高さを持たせる
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
    // 未選択商品（金額が入っていない商品）は表示しない。
    for (const product of products) {
        const itemsForProduct = itemsByProductId.get(product.id) ?? []
        if (itemsForProduct.length === 0) {
            continue
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
                let isMergedDescription = false
                if (isMergedMode && isFirstRow && estimateItem.multiSelectVariantIds) {
                    try {
                        const ids: string[] = JSON.parse(estimateItem.multiSelectVariantIds)
                        const names = (product.variants || [])
                            .filter((v) => ids.includes(String(v.id)))
                            .map((v) => v.name)
                        if (names.length > 0) {
                            displayDescription = names.join('、')
                            isMergedDescription = true
                        }
                    } catch { /* ignore */ }
                }
                // グループ商品(hasVariantGroups)は、各行の摘要（選択した種類名）を改行区切りで
                // 1行目のセルにまとめて表示する。各行は個別にAutoFitOneLineTextで自動縮小・省略
                // 対象にする（行に分けて表示する数・内容自体は商品ごとに決まっているため、
                // 各行が1行の幅に収まらない場合のみ縮小・省略が発動する）。
                let displayDescriptionLines: string[] | undefined
                if (isVariantGroupMode && isFirstRow && itemsForProduct.length > 1) {
                    displayDescriptionLines = itemsForProduct.map((it) => it.description || '').filter(Boolean)
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
                    // 品名は保存時点の控えを優先する（商品マスタで改名しても発行済み書類の文言を変えない）
                    label: isFirstRow ? displayProductItemName(estimateItem, product.name) : '',
                    estimateItem,
                    showProductVariantName: isFirstRow && !!product.showProductVariantName,
                    hideDescription: isEachMode ? false : !isFirstRow,
                    isSecondaryRow: !isFirstRow,
                    displayDescription,
                    displayDescriptionLines,
                    isMergedDescription,
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
            // showProductVariantName有効な商品は品名の下に括弧書きの種類名を表示するため、
            // 通常の1行の高さに収まらない。霊柩車のように元々複数行構成(itemsForProduct.length>1)
            // の商品は既に2行分の高さがあるため問題ないが、単一行の商品(御供養等)で実際に
            // 種類名が表示される場合は、行の高さが中途半端な値になってしまう。
            // rowSpanで2行に分割すると、ブラウザが高さを均等配分せず1行目に寄せてしまうため、
            // 行を分割せず、その1行自体に明示的に2行分の高さを持たせて統一する。
            if (itemsForProduct.length === 1 && product.showProductVariantName) {
                const onlyItem = itemsForProduct[0]
                const resolvedVariantLabel =
                    onlyItem.productVariant?.abbreviatedName ?? onlyItem.productRowVariant?.abbreviatedName
                if (resolvedVariantLabel) {
                    rows[rows.length - 1].needsDoubleHeight = true
                }
            }
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
        if (isCancellationFeeRow(fi.productItemName)) continue
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

const ALTAR_TYPE_LABEL: Record<string, string> = {
    NONE: 'なし',
    PAPER: '紙祭壇',
    WOOD: '木祭壇',
    ANNIVERSARY: '年忌祭壇',
    BUTSUSHIKI_4SHAKU: '4尺仏式',
    YOFU_4SHAKU: '4尺洋風',
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
// 故人名は文字数に応じて縮小するが、行の高さまで一緒に縮むとヘッダー全体が低くなる。
// 明細テーブルの高さは「ヘッダーは常にHEADER_HEIGHT_PX」という前提で決めているため、
// 縮んだ分がそのまま明細表の下（差引合計額の行と外枠の間）の隙間として残ってしまう。
// 最大サイズ(1.875rem=30px)の行の高さに固定し、文字サイズによらず一定にする。
const DECEASED_NAME_LINE_HEIGHT_PX = 30


// 明細欄は常に「39行」固定とする（品目行がこれに満たない分は空白行で埋める。
// 印刷後の手書き記入用の余白も兼ねる）。品目数に関わらずページ内の行数・行間は
// 変えない（帳票として、書類ごとに明細欄のフォントサイズが違って見えるのはおかしいため）。
const ITEM_TABLE_TARGET_BODY_ROWS = 39

// ヘッダー・フッターの位置を常に固定するため、明細テーブルが「使える高さ」ちょうどに
// 収まるよう調整する。行の高さ(行間)は「起こりうる最大パターン」を基準に一度だけ
// 計算し、全書類共通の固定値として使う（書類ごとに動的計算すると、同じ39行でも
// 会員数によってフォントサイズが違って見えてしまうため）。
const ITEM_TABLE_FONT_PX = 12
const ITEM_TABLE_BORDER_PX = 1
const ITEM_TABLE_DEFAULT_LEADING = 1.5
const ITEM_TABLE_MIN_LEADING = 1.15
// thead（品名見出し行）+ tfoot基本3行（小計・消費税・合計）は本文行と同じ12pxフォント。
// 差引合計額のみ calc(0.75rem + 2pt) の大きいフォントで、他行と別枠で計算する。
// いずれもテーブル全体の line-height 倍率で本文行と同じ比率で伸縮するため、
// 「本文行N行相当」という近似ではなく実フォントサイズから正確に高さを算出する。
// 会員入金額行（0〜3行・会員数により変動）・解約手数料行（値引含む2行）は呼び出し側で加算する。
const ITEM_TABLE_UNIFORM_FIXED_ROW_COUNT = 4 // thead + 小計 + 消費税 + 合計
const ITEM_TABLE_GRAND_TOTAL_FONT_PX = 12 + 2 * (96 / 72) // 差引合計額の calc(0.75rem + 2pt) と一致させる

// 1ページに使える実際の高さ(px)。幅の共有定数は pdfLayoutConstants.ts を参照。
// 外枠(border-2)の上下 = 2px×2辺 = 4px
const OUTER_FRAME_BORDER_PX = 4
const PAGE_CONTENT_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM - PAGE_BODY_PADDING_PX - OUTER_FRAME_BORDER_PX

// ヘッダー（タイトル・故人情報）とフッター（互助会テーブル）は内容によらずほぼ一定のサイズになるため、
// 実測から校正した固定値として扱う。JSでの動的測定（ref計測）はWebフォント読み込みの
// タイミングに結果が左右されてしまう（フォールバックフォントで測定してしまうことがある）ため使わない。
// 明細テーブルに使える高さは、この固定値をページ高さから差し引いた残りとする。
const HEADER_HEIGHT_PX = 112.796875
const FOOTER_HEIGHT_PX = 86
// 明細行は「その行が実際に何行分の高さになるか」(itemRowUnitCount)を数えたうえで、
// その行数ぶんの高さを明示指定しているため、計算値と実描画のズレはブラウザの端数丸め
// （後述のborder-collapse分）程度に収まる。安全マージンは「行間（フォントサイズ）」を
// 決める際の最大パターン(行数最多)の判定にだけ効かせ、1行の高さの半分を確保する。
// 書類ごとの空白行数・端数吸収（差引合計額の高さ）は、マージンを引かない本来の予算を
// フルに使う（そうしないと、実際には余裕があるのに使われない余白が残ってしまうため）。
const ITEM_TABLE_SAFETY_MARGIN_PX = (ITEM_TABLE_FONT_PX * ITEM_TABLE_DEFAULT_LEADING + ITEM_TABLE_BORDER_PX) / 2
const ITEM_TABLE_FULL_BUDGET_PX = PAGE_CONTENT_HEIGHT_PX - HEADER_HEIGHT_PX - FOOTER_HEIGHT_PX
const ITEM_TABLE_BUDGET_PX = ITEM_TABLE_FULL_BUDGET_PX - ITEM_TABLE_SAFETY_MARGIN_PX

// 固定行（thead + 小計 + 消費税 + 合計 + 差引合計額）の合計高さを line-height から正確に算出する。
// theadはテーブル最初の行のため border-t-0（上罫線なし）で、border-collapse により
// 他の行より実測で0.5px分だけ低くなる（実測: 通常行18.03pxに対しthead17.53px）。
const ITEM_TABLE_THEAD_BORDER_DEFICIT_PX = 0.5
// border-collapseでは、N行のテーブルは境界線が(N+1)本になる（各行の境界を共有し合い、
// 最初と最後にもう1本ずつ)が、「1行あたり+ITEM_TABLE_BORDER_PX」という積み上げ式の
// 計算はN本分（N×1px）にしかならず、テーブル全体で共有される最後の1本分(1px)が
// 常に不足する。単純なN行テーブル(5/10/20/40行)で実測し、傾き=行の高さ通り・
// 切片=1px（行数によらず一定）であることを検証済み。
const ITEM_TABLE_BORDER_COLLAPSE_EXTRA_PX = 1
function fixedRowsHeightPx(leading: number): number {
    const uniformRowHeight = ITEM_TABLE_FONT_PX * leading + ITEM_TABLE_BORDER_PX
    const grandTotalRowHeight = ITEM_TABLE_GRAND_TOTAL_FONT_PX * leading + ITEM_TABLE_BORDER_PX
    return (
        ITEM_TABLE_UNIFORM_FIXED_ROW_COUNT * uniformRowHeight -
        ITEM_TABLE_THEAD_BORDER_DEFICIT_PX +
        grandTotalRowHeight +
        ITEM_TABLE_BORDER_COLLAPSE_EXTRA_PX
    )
}

// フッター変動行（会費入金額・解約手数料）の起こりうる最大行数。
// 互助会は最大3件（Membership3Tab）+ 解約手数料(値引含む2行)。
const MAX_MEMBERSHIP_ROWS = 3
const MAX_CANCELLATION_EXTRA_ROWS = 2
const MAX_FOOTER_EXTRA_ROWS = MAX_MEMBERSHIP_ROWS + MAX_CANCELLATION_EXTRA_ROWS

// 明細テーブルの行間を「起こりうる最大パターン（フッター変動行が最大の場合）」を基準に
// 一度だけ決定する。書類ごとの実際のフッター変動行数で毎回計算し直すと、同じ39行でも
// 会員数によってフォントサイズが違って見えてしまうため、全書類で共通の固定値として扱う。
// 1) 通常の行間(1.5)のまま最大パターンでも収まるなら、行間は1.5のまま
// 2) 最大パターンで収まらない場合のみ、39行を死守しつつ行間を詰める(下限1.15)
function computeItemTableLineHeight(budgetPx: number): number {
    const rowUnitAtDefaultPx = ITEM_TABLE_FONT_PX * ITEM_TABLE_DEFAULT_LEADING + ITEM_TABLE_BORDER_PX
    const usedAtDefaultLeading =
        fixedRowsHeightPx(ITEM_TABLE_DEFAULT_LEADING) +
        (ITEM_TABLE_TARGET_BODY_ROWS + MAX_FOOTER_EXTRA_ROWS) * rowUnitAtDefaultPx
    if (usedAtDefaultLeading <= budgetPx) {
        return ITEM_TABLE_DEFAULT_LEADING
    }
    // 固定行・本文行(39行)・フッター変動行(最大)のすべてが同じ line-height 倍率で伸縮する前提で
    // budgetPx = fixedRowsHeightPx(L) + (39+MAX_FOOTER_EXTRA_ROWS) * (FONT*L + BORDER) を L について解く。
    const variableRows = ITEM_TABLE_TARGET_BODY_ROWS + MAX_FOOTER_EXTRA_ROWS
    const fixedFontSum = ITEM_TABLE_UNIFORM_FIXED_ROW_COUNT * ITEM_TABLE_FONT_PX + ITEM_TABLE_GRAND_TOTAL_FONT_PX
    const fixedBorderSum =
        (ITEM_TABLE_UNIFORM_FIXED_ROW_COUNT + 1) * ITEM_TABLE_BORDER_PX -
        ITEM_TABLE_THEAD_BORDER_DEFICIT_PX +
        ITEM_TABLE_BORDER_COLLAPSE_EXTRA_PX
    const requiredLeading =
        (budgetPx - fixedBorderSum - variableRows * ITEM_TABLE_BORDER_PX) /
        (fixedFontSum + variableRows * ITEM_TABLE_FONT_PX)
    return Math.max(ITEM_TABLE_MIN_LEADING, requiredLeading)
}

// 明細テーブルの行間は全書類共通の固定値（起こりうる最大パターンから一度だけ算出）。
const ITEM_TABLE_LINE_HEIGHT = computeItemTableLineHeight(ITEM_TABLE_BUDGET_PX)

// 書類ごとの実際のフッター変動行数（最大パターンより少ない分）で余った高さは、
// 1行あたりの高さが固定(ITEM_TABLE_LINE_HEIGHT)なので、通常サイズの空白行を
// 追加するだけで（行間を変えずに）ほぼ埋まる。整数行に割り切れない端数だけは、
// 表の途中に不自然に大きい空白行を作らず、差引合計額の行の高さで吸収する。
function computeItemTableRowPlan(
    footerExtraRows: number,
    budgetPx: number
): { targetBodyRows: number; grandTotalExtraPx: number } {
    const rowUnit = ITEM_TABLE_FONT_PX * ITEM_TABLE_LINE_HEIGHT + ITEM_TABLE_BORDER_PX
    const availableForBodyRows = budgetPx - fixedRowsHeightPx(ITEM_TABLE_LINE_HEIGHT) - footerExtraRows * rowUnit
    const targetBodyRows = Math.max(ITEM_TABLE_TARGET_BODY_ROWS, Math.floor(availableForBodyRows / rowUnit))
    const usedPx = fixedRowsHeightPx(ITEM_TABLE_LINE_HEIGHT) + (targetBodyRows + footerExtraRows) * rowUnit
    // 端数は差引合計額の行の高さで吸収する。以前はここで差引合計額の高さに一律+3pxして
    // いたが、それだと表の高さが常に予算を3px超過し、下端（差引合計額の罫線）が切れる
    // 状態だったため廃止した。
    // 各行の高さはブラウザ側でサブピクセル丸めされ、行数や罫線の共有状況によって計算値と
    // 数pxずれる。はみ出す側にずれると下端が切れてしまうので、吸収量から丸め分を引いて
    // 必ず少し足りない側に倒しておく。足りなかった分は、明細テーブルに height:100% を
    // 指定してあるためブラウザが各行へごくわずかずつ配分して埋める（枠との隙間は出ない）。
    const ROUNDING_ALLOWANCE_PX = 2
    return { targetBodyRows, grandTotalExtraPx: Math.max(0, budgetPx - usedPx - ROUNDING_ALLOWANCE_PX) }
}

export function PdfInvoiceLayout({
    contentId,
    containerRef,
    title,
    document: doc,
    products,
    hideSelectedOptions,
    showSeparateFees,
    showInvoiceFees,
    bankTransferText,
}: Props) {
    const { docNo, membershipPaidAmount, items } = doc
    const docAny = doc as any
    const formatDate = useDateFormat()
    const isMember = doc.isMember === true
    // ローカル開発環境でのみ、PDF生成日時をページ左下に薄く表示する（レイアウト崩れ・
    // キャッシュ切り分けの目視確認用。顧客向けの本番PDFには出さない）
    const [renderedAt] = useState(() => new Date())
    // DB保存値ではなく実際のitems/freeItemsから合計を再計算
    // 解約手数料: qty>0 で登録されていれば、合計欄に「解約手数料」「値引」の2行を表示。
    // 解約手数料は小計に含めない（消費税対象外）。値引で相殺するため差引合計にも影響しない。
    const cancellationFee = (doc.freeItems ?? [])
        .filter((fi) => isCancellationFeeRow(fi.productItemName) && (fi.qty ?? 0) > 0)
        .reduce((sum, fi) => sum + fi.unitPriceGeneral * fi.qty, 0)
    const showCancellationFee = cancellationFee >= 1
    // フリー項目の小計。解約手数料の除外と、会員だけに効く割引（満期サービス・施行割増券）の
    // 扱いは共通処理に任せる
    const freeSubtotalMember = calcFreeItemsSubtotal(doc.freeItems, true)
    const freeSubtotalGeneral = calcFreeItemsSubtotal(doc.freeItems, false)
    // 複数行構成商品（親子セットの加算/返品ペア等）かどうか
    const isMultiRowItem = (item: PdfDocumentItem): boolean => !!(item.productRowId && item.calcType)
    // 明細1行の金額と 0 円扱いの判定は共通処理に任せる。ここで条件を書き足すと、
    // 画面・保存値・PDFで金額が食い違う。
    // PDFは会員価格列と一般価格列の両方を印字するため、同じ明細を会員・一般それぞれの条件で判定する。
    const itemAmountFor = (item: PdfDocumentItem, isMember: boolean): number =>
        calcDocumentItemAmount(item, item.qty, isMember)

    // 会員価格（0円扱いの行は共通処理側で 0 になる）
    const itemsMemberSubtotal = items.reduce((sum, item) => sum + itemAmountFor(item, true), 0)
    const memberSubtotal = itemsMemberSubtotal + freeSubtotalMember
    const memberTax = Math.round(memberSubtotal * 0.1) // 消費税は10%で固定、端数は四捨五入（画面・保存側と揃える）
    const memberTotal = memberSubtotal + memberTax
    // 一般価格
    const itemsGeneralSubtotal = items.reduce((sum, item) => sum + itemAmountFor(item, false), 0)
    const generalSubtotal = itemsGeneralSubtotal + freeSubtotalGeneral
    const generalTax = Math.round(generalSubtotal * 0.1)
    const generalTotal = generalSubtotal + generalTax
    // 差引合計: 解約手数料と値引（=解約手数料×-1）が相殺されるため、解約手数料分の影響は無い。
    // 会費入金額は互助会員が事前に積み立てたお金なので、会員価格列のみ控除する。
    const generalGrandTotal = calcGrandTotal(generalTotal, membershipPaidAmount, false)
    const memberGrandTotal = calcGrandTotal(memberTotal, membershipPaidAmount, true)
    const customer: PdfDocumentCustomer | undefined = docAny.customer
        ? {
              ...docAny.customer,
              cremationProcessType: docAny.cremationProcessType ?? null,
              altarPlaceType: docAny.altarPlaceType ?? null,
              altarPlaceOther: docAny.altarPlaceOther ?? null,
              altarType: docAny.altarType ?? null,
              ceilingHeight: docAny.ceilingHeight ?? null,
              preConsultStaff: docAny.preConsultStaff ?? null,
              estimateStaff: docAny.estimateStaff ?? null,
              ceremonyStaff: docAny.ceremonyStaff ?? null,
              transportStaff: docAny.transportStaff ?? null,
              decorationStaff: docAny.decorationStaff ?? null,
              returnStaff: docAny.returnStaff ?? null,
          }
        : undefined
    const displayRows = buildDisplayRows(products, items, doc.freeItems)
    // 摘要欄は「摘要テキスト」と「数量・単価」を上下に積んで表示するため、行によって
    // 1行にも2行以上にもなる。どの行が何行になるかをここで確定させ、
    //   ・空白行の本数(blankRowCount)
    //   ・その行に持たせる高さ(rowStyle)
    //   ・実際の描画（1行ずつ高さを固定した自動縮小表示）
    // の3つが必ず同じ行数を見るようにする。折り返しに任せると行数が予測できず、
    // 明細表が使える高さを超えてページ下端が切れてしまうため、ここで一本化している。
    const buildDescriptionLines = (row: DisplayRow): string[] => {
        const lines: string[] = []
        const pushText = (text: string) => {
            if (text) lines.push(...text.split('\n'))
        }
        // 摘要テキストの前後にある空行（入力時に紛れ込んだ改行・空白だけの行）は、
        // 中身が無いのに明細欄の行を消費してしまうため落とす。
        // 文章の途中の空行と、行内の字下げ（先頭の空白）はそのまま残す。
        const pushDescriptionText = (text: string) => {
            const raw = text.split('\n')
            let start = 0
            let end = raw.length
            while (start < end && raw[start].trim() === '') start++
            while (end > start && raw[end - 1].trim() === '') end--
            for (let i = start; i < end; i++) lines.push(raw[i])
        }
        // 1) 摘要テキスト
        if (row.displayDescriptionLines && !row.isSecondaryRow) {
            lines.push(...row.displayDescriptionLines)
        } else if (row.isMergedDescription && !row.isSecondaryRow) {
            pushDescriptionText(
                `${row.displayDescription ?? ''}${
                    row.showQtyInDescription && row.estimateItem?.qty
                        ? `　${row.estimateItem.qty.toLocaleString()}${row.estimateItem?.productVariant?.unitLabel ?? ''}`
                        : ''
                }`
            )
        } else {
            const baseText = !row.isSecondaryRow ? (row.displayDescription ?? row.estimateItem?.description ?? '') : ''
            // 複数行構成商品: useForDescriptionLabel行(この行自体)の選択種類名を摘要欄に追記
            const labelText = row.isDescriptionLabelRow ? (row.descriptionLabelOverride ?? '') : ''
            // 商品マスタ設定: 摘要欄末尾に個数(+単位)を追記（種類も表示する場合は「種類　個数」の順）
            const qtyText =
                row.isDescriptionLabelRow && row.showQtyInDescription && row.descriptionQtyOverride
                    ? `　${row.descriptionQtyOverride.toLocaleString()}${row.descriptionUnitLabel ?? ''}`
                    : !row.hasDescriptionLabelRow &&
                        !row.isSecondaryRow &&
                        row.showQtyInDescription &&
                        row.estimateItem?.qty
                      ? `　${row.estimateItem.qty.toLocaleString()}${row.estimateItem?.productVariant?.unitLabel ?? ''}`
                      : ''
            pushDescriptionText(`${baseText}${labelText}${qtyText}`)
        }
        // 2) 数量・単価
        if (!row.isSecondaryRow) {
            // 複数行構成商品(単価×数量型)は「数量 × 単価」を表示。それ以外は数量が1より大きい場合のみ表示。
            // 親付きフリー行（満期サービス以外）は qty=1 でも常に数量を表示。
            // showQtyInDescription有効時は摘要欄に個数を出しているため重複を避ける。
            const qtyText =
                row.estimateItem &&
                isMultiRowItem(row.estimateItem) &&
                row.estimateItem.calcType === 'UNIT_PRICE_X_QTY'
                    ? `${row.estimateItem.qty.toLocaleString()} × ¥${fmtAmount(isMember ? row.estimateItem.unitPriceMember : row.estimateItem.unitPriceGeneral)}`
                    : row.estimateItem &&
                        !row.showQtyInDescription &&
                        (row.estimateItem.qty > 1 || (row.isFreeItem && row.isFixedRow && !row.isMaturity))
                      ? `数量: ${row.estimateItem.qty.toLocaleString()}`
                      : ''
            // 複数行構成商品(hasReturn)の返品行。数量>0のときのみ「▲数量 × 単価」を次の行に追記する
            const deductionText =
                row.deductionItem && (row.deductionItem.qty ?? 0) > 0
                    ? `\n▲${row.deductionItem.qty.toLocaleString()} × ¥${fmtAmount(isMember ? row.deductionItem.unitPriceMember : row.deductionItem.unitPriceGeneral)}`
                    : ''
            const unitPriceText =
                row.isFreeItem && !row.isFixedRow && row.estimateItem
                    ? `${row.estimateItem.qty > 1 ? '　' : ''}単価: ¥${fmtAmount(row.estimateItem.unitPriceGeneral)}`
                    : ''
            pushText(`${qtyText}${deductionText}${unitPriceText}`)
        }
        return lines
    }
    // その明細行が明細欄の何行分の高さを占めるか。
    // ・複数行構成商品の先頭行は、摘要セルが rowSpan で後続行とまとめて multiRowGroupSize 行に
    //   またがるため、摘要がその行数を超える分だけを先頭行に加算する（後続行はそれぞれ1行）。
    //   ただし行ごとに摘要を出す商品(hasDescriptionLabelRow)は摘要セルがまたがらないので対象外。
    // ・品名の下に種類名を出す行は品名側だけで2行必要
    const itemRowUnitCount = (row: DisplayRow): number => {
        const descriptionLineCount = buildDescriptionLines(row).length
        if (row.multiRowGroupSize && !row.hasDescriptionLabelRow) {
            return Math.max(1, descriptionLineCount - (row.multiRowGroupSize - 1))
        }
        return Math.max(1, row.needsDoubleHeight ? 2 : 1, descriptionLineCount)
    }
    // tfoot内の会員入金額行・解約手数料行（値引含む2行）は品目数に応じて増減する。
    // 行間(ITEM_TABLE_LINE_HEIGHT)は全書類共通の固定値。フッター変動行数が
    // 最大パターンより少ない書類は、その分だけ通常サイズの空白行が増える
    // （39行が最低保証、それ以上は書類ごとの余裕次第）。
    const displayedMembershipCount = buildMembershipPaymentRows(customer?.memberships).length
    const itemTableFooterExtraRows = displayedMembershipCount + (showCancellationFee ? 2 : 0)
    const itemTableLineHeight = ITEM_TABLE_LINE_HEIGHT
    const { targetBodyRows, grandTotalExtraPx } = computeItemTableRowPlan(
        itemTableFooterExtraRows,
        ITEM_TABLE_FULL_BUDGET_PX
    )
    // 品目行が目標行数(最低39行、余裕があればそれ以上)に満たない分だけ空白行で埋める。
    // 2行以上を占める明細行は、見た目上1行(DisplayRow1件)でもその行数分としてカウントする。
    const itemRowUnitTotal = displayRows.reduce((sum, row) => sum + itemRowUnitCount(row), 0)
    const blankRowCount = Math.max(0, targetBodyRows - itemRowUnitTotal)
    // 満期サービス行は商品行群の直後ではなく、明細欄の最終行（小計の直前）に固定表示する
    const normalRows = displayRows.filter((row) => !row.isMaturity)
    const maturityRows = displayRows.filter((row) => row.isMaturity)
    const renderItemRow = (row: DisplayRow, index: number, rows: DisplayRow[], keyPrefix: string) => {
        const isNextSecondary = rows[index + 1]?.isSecondaryRow
        const mergeCls = `${row.isSecondaryRow ? 'border-t-0' : ''} ${isNextSecondary ? 'border-b-0' : ''}`
        // 2行以上を占める行は、明示的にその行数分の高さを指定して、行数計算と実際の高さを
        // 一致させる（rowSpanで分割すると高さが均等配分されないため、行自体は分けない）。
        // 複数行構成商品の先頭行だけは rowSpan で後続行と高さを分け合うので指定しない。
        const rowUnitCount = itemRowUnitCount(row)
        const descriptionLines = buildDescriptionLines(row)
        const rowStyle =
            !row.multiRowGroupSize && rowUnitCount > 1
                ? {
                      // 行の高さは「N×(文字の高さ+罫線)」。通常の行N本ぶんとちょうど同じにする
                      // （以前はここから罫線1本分を引いていたため、2行以上の行がある書類だけ
                      // 表全体が1pxずつ低くなり、下端の隙間が書類によってばらついていた）。
                      height: `${rowUnitCount * (ITEM_TABLE_FONT_PX * itemTableLineHeight + ITEM_TABLE_BORDER_PX)}px`,
                  }
                : undefined
        return (
        <Fragment key={`${keyPrefix}-${index}`}>
            <tr key={`${keyPrefix}-main-${index}`} style={rowStyle}>
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
                    {/* 摘要欄は buildDescriptionLines で確定させた行数ぶんだけ、1行ずつ高さを固定して
                        描画する。各行は幅に収まらなければ自動縮小（それでも収まらなければ末尾を省略）
                        するため、想定外の折り返しで行が増えて明細表が伸びることがない。 */}
                    {descriptionLines.map((line, i) => (
                        <div
                            key={i}
                            style={{
                                // N行ぶんの高さは「N×(文字の高さ+罫線) − 罫線」。行と行の間にだけ罫線1本分が
                                // 入るので、最終行にはそれを足さない。ここで足してしまうと1行の行が1pxずつ
                                // 高くなり、行数が多い書類で表全体が数十px膨らんでページ下端が切れる。
                                height: `${ITEM_TABLE_FONT_PX * itemTableLineHeight + (i < descriptionLines.length - 1 ? ITEM_TABLE_BORDER_PX : 0)}px`,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <AutoFitOneLineText text={line} basePx={ITEM_TABLE_FONT_PX} />
                        </div>
                    ))}
                </td>
                )}
                {/* 金額は align-top。2行以上を占める行で、金額が行の上下中央ではなく
                    1行目（品名・摘要の1行目と同じ位置）に並ぶようにする。
                    1行だけの行では上下中央と同じ位置になるため見た目は変わらない。 */}
                <td
                    className={`border border-black px-1 text-right align-top ${mergeCls}`}
                >
                    {row.estimateItem && !row.isMaturity ? (
                        noChargeReasonFor(row.estimateItem, false) ? (
                            <span style={{ fontWeight: 600 }}>
                                {NO_CHARGE_LABELS[noChargeReasonFor(row.estimateItem, false)!]}
                            </span>
                        ) : (
                            fmtAmount(itemAmountFor(row.estimateItem, false))
                        )
                    ) : (
                        ''
                    )}
                </td>
                <td
                    className={`border border-r-0 border-black px-1 text-right align-top ${mergeCls}`}
                >
                    {row.estimateItem ? (
                        noChargeReasonFor(row.estimateItem, true) ? (
                            <span style={{ fontWeight: 600 }}>
                                {NO_CHARGE_LABELS[noChargeReasonFor(row.estimateItem, true)!]}
                            </span>
                        ) : (
                            fmtAmount(itemAmountFor(row.estimateItem, true))
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
            style={{ fontFamily: '"Noto Serif JP", serif', fontSize: '16px' }}
        >
            {/* ローカル開発環境のみ: PDF生成日時（キャッシュ・レイアウト崩れの目視確認用、本番の顧客向け書類には出さない）。
                position:fixedでレイアウト計算（明細行数・行間）には一切影響しない */}
            {process.env.NEXT_PUBLIC_IS_LOCAL === 'true' && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '2px',
                        left: '4px',
                        fontSize: '7px',
                        color: '#bbb',
                        fontFamily: 'monospace',
                    }}
                >
                    生成: {renderedAt.getFullYear()}-{String(renderedAt.getMonth() + 1).padStart(2, '0')}-
                    {String(renderedAt.getDate()).padStart(2, '0')} {String(renderedAt.getHours()).padStart(2, '0')}:
                    {String(renderedAt.getMinutes()).padStart(2, '0')}:{String(renderedAt.getSeconds()).padStart(2, '0')}
                </div>
            )}
            {/* ページ1（見積書本体）だけをこのFlexboxで囲み、高さを固定する。
                「選択オプション画像ページ」はこの外側にあるため、複数ページに自由に伸びる。
                ヘッダー・フッターは自然な高さのまま、明細部分(外枠)だけがflex:1で残り高さを埋める。
                JSでの高さ測定・計算に頼らず、ブラウザのレイアウトエンジンにヘッダー・フッターの
                位置決めを任せることで、上下の余白を常に正確に一致させる。 */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: `${A4_HEIGHT_MM * PX_PER_MM - PAGE_BODY_PADDING_PX}px`,
                }}
            >
            {/* 外枠: flex:1で「ヘッダー・フッターを除いた残り高さ」を占める */}
            <div
                className="border-2 border-black"
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}
            >
                {/* ヘッダー（タイトル・故人情報）: 実際の高さを測定し、明細テーブルの行間計算に使う */}
                <div>
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
                                className="inline-block whitespace-nowrap border-b border-black pb-[4px] align-bottom font-black tracking-wide"
                                style={{
                                    fontSize: getDeceasedNameFontSize(customer?.deceasedName),
                                    lineHeight: `${DECEASED_NAME_LINE_HEIGHT_PX}px`,
                                }}
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
                </div>

                <div
                    className="flex justify-between gap-0"
                    style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}
                >
                    {/* 明細ブロック */}
                    <div className="w-[60%] border-r-2 border-black" style={{ overflow: 'hidden' }}>
                        <table
                            className="w-full border-collapse text-[0.75rem]"
                            style={{ lineHeight: itemTableLineHeight, tableLayout: 'fixed', height: '100%' }}
                        >
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
                                {Array.from({ length: blankRowCount }).map((_, i) => (
                                    <tr key={`blank-${i}`}>
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
                                    // 行の有無も金額も共通処理に任せる。ここで別の式を書くと、
                                    // 書類に出ている内訳の合計と差引合計から引いた額が食い違う
                                    const displayedMemberships = buildMembershipPaymentRows(customer?.memberships)
                                    return displayedMemberships.map(({ membership: m, rowIndex: originalIdx, amount: subtotal }, idx) => {
                                        // けやきは割引額を直接入力する仕様で、1回の入金額×回数では出せない
                                        const isKeyaki = originalIdx === KEYAKI_ROW_INDEX
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
                                <tr
                                    style={{
                                        fontSize: 'calc(0.75rem + 2pt)',
                                        // 空白行は整数単位でしか追加できず割り切れない端数が残るため、
                                        // 表の途中に不自然に大きい空白行を作る代わりに、最終行である
                                        // 差引合計額の高さだけをこの端数分伸ばして吸収する。
                                        ...(grandTotalExtraPx > 0
                                            ? {
                                                  height: `${ITEM_TABLE_GRAND_TOTAL_FONT_PX * itemTableLineHeight + ITEM_TABLE_BORDER_PX + grandTotalExtraPx}px`,
                                              }
                                            : {}),
                                    }}
                                >
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
                    <div className="flex w-[40%] flex-col text-sm" style={{ overflow: 'hidden' }}>
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
                                                    ? customer?.returnAtTimeUnspecified
                                                        ? `${fmtDate(customer.returnAt)}`
                                                        : `${fmtDate(customer.returnAt)} ${fmtTime(customer.returnAt)}`
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
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-black px-1 text-[0.75rem]">
                            <div>(備考)</div>
                            <div className="mx-2 min-h-0 flex-1 overflow-hidden">
                                {showSeparateFees && (
                                    <div className="whitespace-pre-wrap break-words">
                                        {buildSeparateFeesText(doc)}
                                    </div>
                                )}
                                {showInvoiceFees && (
                                    <div>
                                        {/* 葬儀代金は明細表の差引合計額と同じ値。DB保存値を参照すると同じPDF内で金額が食い違う */}
                                        {buildInvoiceFeeLines(
                                            isMember ? memberGrandTotal : generalGrandTotal,
                                            doc.flowerFee
                                        ).map((line) => (
                                            <div
                                                key={line.label}
                                                // 生花代と支払合計の間だけ罫線を挟む。行を増やさず下線として引く
                                                className={line.underline ? 'border-b border-black' : ''}
                                                style={{ width: INVOICE_FEE_BLOCK_WIDTH }}
                                            >
                                                {line.label}：{line.amountText}
                                            </div>
                                        ))}
                                        <div>{SEPARATE_FEES_BLOCK_END}</div>
                                    </div>
                                )}
                                {doc.remarks ? (
                                    <div className="whitespace-pre-wrap break-words">{doc.remarks}</div>
                                ) : null}
                            </div>
                            {/* 振込先は備考本文の量にかかわらず、備考欄の最下部に固定で出す。
                                口座名義まで入ると備考欄の幅に収まらないことがあるため、1行に収まるよう自動縮小する */}
                            {bankTransferText ? (
                                <div className="mx-2 shrink-0">
                                    <AutoFitOneLineText text={bankTransferText} basePx={REMARKS_FONT_PX} />
                                </div>
                            ) : null}
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
                                        <div className="flex items-baseline">
                                            {(['HOME', 'FUNERAL_HALL', 'OTHER'] as const).map((key, i) => (
                                                <Fragment key={key}>
                                                    {i > 0 && '・'}
                                                    <span className={customer?.altarPlaceType === key ? 'underline font-bold' : ''}>
                                                        {ALTAR_LABEL[key]}
                                                    </span>
                                                </Fragment>
                                            ))}
                                            {'（'}
                                            {customer?.altarType ? (ALTAR_TYPE_LABEL[customer.altarType] ?? '') : ''}
                                            {'）'}
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
            {/* 互助会テーブル（差引合計の下・全幅・独立枠）: 自然な高さのまま、flexShrink:0で縮められないようにする */}
            <div style={{ flexShrink: 0 }}>
                <PdfMembershipTable memberships={customer?.memberships} formatDate={formatDate} />
            </div>
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
                                                    {displayProductItemName(it, it.productItem?.name)}
                                                </span>
                                                {it.qty > 1 && (
                                                    <span className="text-[0.7rem]">
                                                        数量: {it.qty.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[0.8rem]">
                                                    {displayProductVariantName(it, it.productVariant?.name)}
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
