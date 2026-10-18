/**
 * 案件削除の確認メッセージ。案件一覧の削除ボタンと削除履歴画面で使う。
 * DBに触れない処理なので画面側から直接使える（削除処理本体は lib/caseDeletion.ts）。
 */

// 一緒に削除される件数 { テーブル名: 件数 }（lib/caseDeletion.ts の CASE_DELETION_TARGETS のテーブル名）
export type CaseDeletionSummary = Record<string, number>

// 確認メッセージ・削除履歴に件数を出すデータ（明細や操作ログのような細かい単位は出さない）
export const CASE_DELETION_SUMMARY_LABELS: { table: string; label: string }[] = [
    { table: 'estimates', label: '見積' },
    { table: 'invoices', label: '請求書' },
    { table: 'payments', label: '入金' },
    { table: 'flowers', label: '供花' },
]

/** 「見積2件・請求書1件」のような一緒に削除される件数の文。何も無ければ空文字 */
export function formatCaseDeletionCounts(summary: CaseDeletionSummary): string {
    return CASE_DELETION_SUMMARY_LABELS.filter(({ table }) => (summary[table] ?? 0) > 0)
        .map(({ table, label }) => `${label}${summary[table]}件`)
        .join('・')
}

export function buildCaseDeletionConfirmMessage(
    customer: { receptionNo?: string | null; deceasedName?: string | null },
    summary: CaseDeletionSummary
): string {
    const receptionNo = customer.receptionNo ? `受付番号${customer.receptionNo} ` : ''
    const counts = formatCaseDeletionCounts(summary)
    const lines = [
        `${receptionNo}${customer.deceasedName ?? ''} の案件を削除します。`,
        counts ? `${counts}も一緒に削除されます。` : '関連する見積・請求書・入金・供花はありません。',
    ]
    if ((summary.payments ?? 0) > 0) {
        lines.push('※入金データがあります。')
    }
    lines.push('', '削除したデータは削除履歴に保存されます。よろしいですか？')
    return lines.join('\n')
}
