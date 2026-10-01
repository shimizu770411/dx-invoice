/**
 * 葬儀・告別式の開始日時を入れたとき、終了日時の日付を開始日に揃える。
 *
 * 告別式が日付を跨ぐ運用は無い。にもかかわらず終了日時は日付から入力する作りだったため、
 * 時刻だけ直して日付を直し忘れる誤入力が起きていた（終了が開始より前になっている案件が複数あった）。
 * 見積・請求書PDFは開始日の日付しか印字しないため、画面でもPDFでも気づけない。
 *
 * 時刻は担当者が入れたものなので触らない。終了日時が未入力のときだけ 0 時を置き、
 * 担当者が時刻を直す前提にする。
 */

const DEFAULT_END_TIME = '00:00'

/**
 * @param start 開始日時（`YYYY-MM-DDTHH:mm`。未入力なら空文字）
 * @param end   現在の終了日時（同上）
 * @returns 新しい終了日時。開始が未入力のときは終了をそのまま返す
 */
export function syncFuneralEndDate(start: string, end: string): string {
    if (!start) return end

    const startDate = start.slice(0, 10)
    if (!end) return `${startDate}T${DEFAULT_END_TIME}`

    const endTime = end.includes('T') ? end.slice(11, 16) : ''
    return `${startDate}T${endTime || DEFAULT_END_TIME}`
}
