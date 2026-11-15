/**
 * 領収書No.（入金登録のときに入れる番号）の判定。入金登録の画面とAPIの両方で使う。
 * 請求書PDFの押印欄の「No」に出す。請求書の「請求番号」（9桁）とは別の番号。
 * 任意入力で、入れる場合は数字ちょうど6桁（例: 625310）。2026-11-05 に7桁で作り、2026-11-16 ユーザー指示で6桁に変更。
 */
export const RECEIPT_NO_LENGTH = 6

export const RECEIPT_NO_INVALID_MESSAGE = `領収書No.は${RECEIPT_NO_LENGTH}桁の数字で入力してください（空欄でも登録できます）`

/** 前後の空白を除いた値。空欄なら null（未設定として保存する） */
export function normalizeReceiptNo(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text === '' ? null : text
}

/** 空欄、または半角数字ちょうど6桁なら正しい */
export function isValidReceiptNo(value: unknown): boolean {
    const text = normalizeReceiptNo(value)
    return text === null || new RegExp(`^[0-9]{${RECEIPT_NO_LENGTH}}$`).test(text)
}
