/**
 * 領収書の宛名。入金登録の画面・API・領収書PDFで使う。
 *
 * 支払者と喪主のどちらに宛てるかは案件によって違うため、入金登録のときに入力して入金に保存する
 * （2026-11-12 ユーザー指示）。初期値は「支払者名、それが空なら喪主名」で、何もしなければ
 * 以前と同じ宛名になる。宛名を保存していない入金（この欄を入れる前の入金）も同じ決め方で出す。
 */
export const RECEIPT_ADDRESSEE_MAX_LENGTH = 100

export const RECEIPT_ADDRESSEE_TOO_LONG_MESSAGE = `領収書の宛名は${RECEIPT_ADDRESSEE_MAX_LENGTH}文字以内で入力してください`

type CustomerNames = {
    payerName?: string | null
    chiefMournerName?: string | null
}

/** 前後の空白を除いた値。空欄なら null（未設定として保存する） */
export function normalizeReceiptAddressee(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text === '' ? null : text
}

/** 空欄、または上限文字数以内なら正しい */
export function isValidReceiptAddressee(value: unknown): boolean {
    const text = normalizeReceiptAddressee(value)
    return text === null || text.length <= RECEIPT_ADDRESSEE_MAX_LENGTH
}

/** 宛名の初期値。支払者名、それが空なら喪主名 */
export function defaultReceiptAddressee(customer?: CustomerNames | null): string {
    return normalizeReceiptAddressee(customer?.payerName) ?? normalizeReceiptAddressee(customer?.chiefMournerName) ?? ''
}

/** 領収書に出す宛名。入金登録で入れた宛名があればそれ、無ければ初期値と同じ決め方 */
export function resolveReceiptAddressee(saved: string | null | undefined, customer?: CustomerNames | null): string {
    return normalizeReceiptAddressee(saved) ?? defaultReceiptAddressee(customer)
}
