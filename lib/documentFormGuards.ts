// 見積・請求書の保存ボタンを押したときの、入力チェック前後の守り。見積・請求書で共通。

/**
 * フォームの明細・自由入力行のうち、画面の明細より後ろに残った行を取り除く。
 *
 * プラン切替で明細が減ると、明細表の描き直しの途中で、消える行の入力欄がフォームにもう一度登録され、
 * 実際の明細より後ろに中身の無い行が残ることがある（2026-10-20 モンキーテストで発見）。
 * その行が入力チェックで弾かれ、「登録」を押しても保存されなかった。
 * 保存の入力チェックより前に呼び、画面の明細と同じ数にそろえる。
 */
export function trimStaleFormRows(
    getValues: (name: 'items' | 'freeItems') => unknown[] | undefined,
    setValue: (name: 'items' | 'freeItems', value: unknown[]) => void,
    counts: { items: number; freeItems: number }
): void {
    for (const name of ['items', 'freeItems'] as const) {
        const rows = getValues(name) ?? []
        if (rows.length > counts[name]) setValue(name, rows.slice(0, counts[name]))
    }
}

const hasJapanese = (text: string) => /[ぁ-んァ-ヶ一-龠]/.test(text)

function findFirstMessage(errors: unknown): string | null {
    if (!errors || typeof errors !== 'object') return null
    const message = (errors as { message?: unknown }).message
    if (typeof message === 'string' && message !== '') return message
    for (const value of Object.values(errors as Record<string, unknown>)) {
        const found = findFirstMessage(value)
        if (found) return found
    }
    return null
}

/**
 * 保存時の入力チェックで止まったときに通知する文言。
 * 以前は明細行の中の項目（数量など）のエラーだと通知を出さず、「登録」を押しても何も起きないように見えていた。
 * 明細行の中まで探し、日本語で書いた文言（「数量オーバー」など）があればそれを、
 * 入力チェックの既定の英語の文言しか無ければ、共通の文言を返す。
 */
export function validationErrorTitle(errors: unknown): string {
    const message = findFirstMessage(errors)
    if (message && hasJapanese(message)) return message
    return '入力内容に誤りがあるため保存できませんでした。明細の数量などを確認してください'
}
