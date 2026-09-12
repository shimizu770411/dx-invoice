/**
 * 見積書・請求書の備考欄の冒頭に固定で出力するブロックの定義。
 *
 * 見積書は【別料金】ブロック（火葬料金 / お布施 / 新聞広告）、
 * 請求書は支払合計ブロック（葬儀代金 / 生花代 / 支払合計）を出力する。
 *
 * どちらも従来は会社設定の「備考初期値設定」に文字列として登録され、
 * 備考欄に自動入力されたうえで担当者が金額を手書きしていた。
 * 現在は金額を専用の項目で受け取り、ブロック自体はPDF側が固定で出力する。
 *
 * 出力側（PDF）・入力画面・旧データの移行側がここの定義を参照することで、
 * 見出しや並びがずれないようにしている。
 */

export const SEPARATE_FEES_BLOCK_START = '【別料金】'
export const SEPARATE_FEES_BLOCK_END = '【備考】'
// 2行目以降の字下げ。従来の手入力と同じ見た目（全角スペース5個＋半角スペース1個）にそろえる
export const SEPARATE_FEE_INDENT = '　　　　　 '

export const SEPARATE_FEE_LABELS = [
    { key: 'cremationFee', label: '火葬料金' },
    { key: 'offeringFee', label: 'お布施' },
    { key: 'newspaperAdFee', label: '新聞広告' },
] as const

export type SeparateFeeKey = (typeof SEPARATE_FEE_LABELS)[number]['key']

export type SeparateFees = {
    cremationFee?: number | null
    offeringFee?: number | null
    newspaperAdFee?: number | null
}

export const EMPTY_SEPARATE_FEES: Record<SeparateFeeKey, number | null> = {
    cremationFee: null,
    offeringFee: null,
    newspaperAdFee: null,
}

/**
 * 見積書PDFの備考欄に出力する【別料金】ブロックの文字列を組み立てる。
 * 金額が未設定の項目は見出しだけを出力し、右側は空欄のままにする。
 */
export function buildSeparateFeesText(fees: SeparateFees): string {
    const [cremation, offering, newspaper] = SEPARATE_FEE_LABELS
    return [
        `${SEPARATE_FEES_BLOCK_START} ・${cremation.label}：${formatFeeAmount(fees.cremationFee)}`,
        `${SEPARATE_FEE_INDENT}・${offering.label}：${formatFeeAmount(fees.offeringFee)}`,
        `${SEPARATE_FEE_INDENT}・${newspaper.label}：${formatFeeAmount(fees.newspaperAdFee)}`,
        SEPARATE_FEES_BLOCK_END,
    ].join('\n')
}

/**
 * 備考欄に出す金額の表記。未設定は空欄にし、負値は他の金額欄と同じ会計表記にそろえる。
 * 0 は「0円」として扱い、空欄にはしない。
 */
export function formatFeeAmount(v?: number | null): string {
    if (v === null || v === undefined) return ''
    return v < 0 ? `▲${Math.abs(v).toLocaleString()}円` : `${v.toLocaleString()}円`
}

export type ParsedSeparateFees = {
    /** ブロックを取り除いたあとの備考本文。残らない場合は null */
    remarks: string | null
    fees: Record<SeparateFeeKey, number | null>
    /** 金額として解釈できなかった記述（見出し名と元の文字列） */
    unparsable: { label: string; raw: string }[]
    /** 【別料金】ブロックが見つかったか */
    found: boolean
}

/**
 * 旧データの備考本文から【別料金】ブロックを切り出し、金額と残りの本文に分解する。
 *
 * ブロックの範囲は「【別料金】を含む行」から「【備考】だけの行」まで。
 * 【備考】の行が見つからない場合は、金額の見出しを含む最後の行までを範囲とする。
 */
export function parseSeparateFeesBlock(remarks: string | null | undefined): ParsedSeparateFees {
    if (!remarks || !remarks.includes(SEPARATE_FEES_BLOCK_START)) {
        return { remarks: remarks ?? null, fees: { ...EMPTY_SEPARATE_FEES }, unparsable: [], found: false }
    }

    const lines = remarks.split('\n')
    const startIdx = lines.findIndex((l) => l.includes(SEPARATE_FEES_BLOCK_START))

    let endIdx = lines.findIndex((l, i) => i >= startIdx && l.trim() === SEPARATE_FEES_BLOCK_END)
    if (endIdx === -1) {
        endIdx = startIdx
        for (let i = startIdx; i < lines.length; i++) {
            if (SEPARATE_FEE_LABELS.some(({ label }) => findLabelSeparator(lines[i], label))) {
                endIdx = i
            }
        }
    }

    const blockLines = lines.slice(startIdx, endIdx + 1)
    const fees: Record<SeparateFeeKey, number | null> = { ...EMPTY_SEPARATE_FEES }
    const unparsable: { label: string; raw: string }[] = []

    for (const { key, label } of SEPARATE_FEE_LABELS) {
        const line = blockLines.find((l) => findLabelSeparator(l, label))
        if (!line) continue
        const sep = findLabelSeparator(line, label)
        if (!sep) continue
        const raw = line.slice(line.indexOf(sep) + sep.length)
        const normalized = normalizeAmountText(raw)
        if (normalized === '') continue
        if (!/^-?\d+$/.test(normalized)) {
            unparsable.push({ label, raw: raw.trim() })
            continue
        }
        fees[key] = Number(normalized)
    }

    const rest = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join('\n')
    // ブロックを取り除いた結果が空白だけなら備考なしとして扱う
    const cleaned = rest.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '')

    return { remarks: cleaned === '' ? null : cleaned, fees, unparsable, found: true }
}

// 「火葬料金：」のような見出しを全角・半角コロンの両方で探す
function findLabelSeparator(line: string, label: string): string | null {
    if (line.includes(`${label}：`)) return `${label}：`
    if (line.includes(`${label}:`)) return `${label}:`
    return null
}

// 金額らしき文字列から、区切り記号・単位・空白を取り除き半角数字にそろえる
function normalizeAmountText(raw: string): string {
    return raw
        .replace(/[，,]/g, '')
        .replace(/円/g, '')
        .replace(/[\s　]/g, '')
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        .replace(/[－ー−]/g, '-')
}

// ──────────────────────────────────────────────────────────
// 請求書の支払合計ブロック
// ──────────────────────────────────────────────────────────

export const INVOICE_FEE_LABELS = {
    /** 請求書本体の差引合計をそのまま載せる。入力欄ではなく自動計算 */
    funeralFee: '葬儀代金',
    /** 唯一の手入力項目 */
    flowerFee: '生花代',
    /** 葬儀代金＋生花代。自動計算 */
    paymentTotal: '支払合計',
} as const

/**
 * 備考欄に出す支払合計。請求書本体の差引合計に生花代を足したもので、
 * 請求書の小計・消費税・差引合計そのものには影響しない。
 */
export function calcInvoicePaymentTotal(grandTotal: number, flowerFee?: number | null): number {
    return grandTotal + (flowerFee ?? 0)
}

// 請求書の備考欄の最下部に出す振込先の見出し
export const BANK_TRANSFER_PREFIX = 'お振込先：'

/**
 * 自社情報の振込先1から、請求書の備考欄に出す1行を組み立てる。
 * 「お振込先：銀行名　支店名　口座種別　口座番号　口座名義」の並びで、
 * 未登録の項目は区切りごと詰める。すべて未登録なら null を返し、行自体を出さない。
 */
export function buildBankTransferText(bank: {
    name?: string | null
    branch?: string | null
    type?: string | null
    account?: string | null
    holder?: string | null
}): string | null {
    const parts = [bank.name, bank.branch, bank.type, bank.account, bank.holder]
        .map((v) => (v ?? '').trim())
        .filter((v) => v !== '')
    if (parts.length === 0) return null
    return `${BANK_TRANSFER_PREFIX}${parts.join('　')}`
}

export type InvoiceFeeLine = {
    label: string
    /** 金額の表記。生花代が未入力のときだけ空文字になる */
    amountText: string
    /** 次の行との間に罫線を引くか（生花代と支払合計の間に入れる） */
    underline: boolean
}

/**
 * 請求書PDFの備考欄に出力する支払合計ブロックの各行を組み立てる。
 * 罫線を挟むため文字列ではなく行ごとに返す。
 */
export function buildInvoiceFeeLines(grandTotal: number, flowerFee?: number | null): InvoiceFeeLine[] {
    return [
        { label: INVOICE_FEE_LABELS.funeralFee, amountText: formatFeeAmount(grandTotal), underline: false },
        { label: INVOICE_FEE_LABELS.flowerFee, amountText: formatFeeAmount(flowerFee), underline: true },
        {
            label: INVOICE_FEE_LABELS.paymentTotal,
            amountText: formatFeeAmount(calcInvoicePaymentTotal(grandTotal, flowerFee)),
            underline: false,
        },
    ]
}
