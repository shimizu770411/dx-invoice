// 商品マスタ・プラン設定の変更履歴（master_change_logs）を、テストの開始時に出す一覧の行にする。
// 「いつ・誰が・何の・どの項目を・何から何に」を1行ずつ。

type ChangeLog = {
    occurredAt: Date
    action: string
    targetName: string
    changes: unknown
    user?: { name: string } | null
}

type Change = { subject?: string; label: string; before?: string; after?: string }

const ACTION_LABELS: Record<string, string> = { CREATE: '登録', UPDATE: '変更', DELETE: '削除' }

export function formatMasterChangeLines(logs: ChangeLog[]): string[] {
    return logs.flatMap((log) => {
        const when = log.occurredAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const who = log.user?.name ?? '不明'
        const head = `  ${when} ${who}「${log.targetName}」${ACTION_LABELS[log.action] ?? log.action}`
        const changes = Array.isArray(log.changes) ? (log.changes as Change[]) : []
        if (changes.length === 0) return [head]
        return [
            head,
            ...changes.map((c) => {
                const what = c.subject ? `${c.subject} ${c.label}` : c.label
                // 「追加」「削除」のような出来事は前後の値を持たない
                return c.before || c.after ? `      ${what}: ${c.before || '（なし）'} → ${c.after || '（なし）'}` : `      ${what}`
            }),
        ]
    })
}
