/**
 * 支払者が喪主と同じかどうかの判定。
 *
 * 「喪主と同じ」はDBに持っていない。保存されるのは支払者の氏名・続柄・住所・電話に
 * 喪主の値を写したものだけなので、同じかどうかは値を突き合わせて判断する。
 *
 * 案件編集画面のチェック状態の復元と、見積・請求書PDFの「同上」表示が
 * 同じ判断で動くよう、ここに集約している。
 */

/** 帳票で「喪主と同じ」を表す記載。手書き伝票の書き方に合わせている */
export const SAME_AS_CHIEF_MOURNER_LABEL = '同上'
/** 直前の行と同じことを表す記載 */
export const DITTO_MARK = '〃'

// 画面のフォームとAPIの応答の両方を受け取るため、値の型は絞らない。
// フォーム側は入力チェックの都合で型が定まらない項目がある
type PayerComparable = {
    chiefMournerName?: unknown
    chiefMournerRelation?: unknown
    chiefMournerAddress?: unknown
    chiefMournerTel?: unknown
    payerName?: unknown
    payerRelation?: unknown
    payerAddress?: unknown
    payerTel?: unknown
}

/** 未入力の表し方が null・undefined・空文字と揺れるため、突き合わせる前に揃える */
function normalize(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

/**
 * 支払者が喪主と同じか。
 * 氏名が未入力のときは判断できないものとして false を返す（両方空でも「同じ」とは見なさない）。
 */
export function isPayerSameAsChiefMourner(customer: PayerComparable): boolean {
    const chiefMournerName = normalize(customer.chiefMournerName)
    const payerName = normalize(customer.payerName)

    if (!chiefMournerName || !payerName) return false

    return (
        chiefMournerName === payerName &&
        normalize(customer.chiefMournerRelation) === normalize(customer.payerRelation) &&
        normalize(customer.chiefMournerAddress) === normalize(customer.payerAddress) &&
        normalize(customer.chiefMournerTel) === normalize(customer.payerTel)
    )
}
