// フックからローカルDBのバックアップを呼ぶ入口。
// フックが渡してくる JSON から「何の作業か」を取り出し、記録に残した上でバックアップ本体を呼ぶ。
//
// 使い方: node hook-backup.mjs <mode>
//   prompt  : UserPromptSubmit。ユーザーの指示文を作業内容として記録し、直近30分以内なら省略する
//   guard   : PreToolUse。DBを壊しうるコマンドを検知したときだけ、そのコマンドを記録して必ず取る
//   session : SessionStart。間隔に関わらず必ず取る
//
// 2026-09-30、バックアップは取れていても「どの作業の直前か」が分からないと復元先を選べないため追加した。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv[2] ?? 'manual'
const HERE = dirname(fileURLToPath(import.meta.url))

// DBを壊しうるものを拾う。取りこぼすより余分に取る方を優先する
const DESTRUCTIVE =
    /shadow-database-url|migrate\s+reset|migrate\s+dev|db\s+push|force-reset|prisma\s+db\s+execute|pg_restore|TRUNCATE|DROP\s+(TABLE|DATABASE|SCHEMA|COLUMN)|DELETE\s+FROM|ALTER\s+TABLE|deleteMany|executeRawUnsafe|\$executeRaw/i

function readStdin() {
    try {
        return JSON.parse(readFileSync(0, 'utf8'))
    } catch {
        return {}
    }
}

function run(reason, minAgeMin, context) {
    try {
        return execFileSync(
            'sh',
            [join(HERE, 'backup-local-db.sh'), reason, String(minAgeMin), context],
            { encoding: 'utf8', timeout: 110_000 }
        ).trim()
    } catch {
        return ''
    }
}

let reason = MODE
let minAge = 0
let context = ''

if (MODE === 'prompt') {
    const input = readStdin()
    // 指示文そのものを作業内容として残す。長い指示は頭を残せば十分たどれる
    context = String(input.prompt ?? '').trim() || '(指示文なし)'
    minAge = 30
} else if (MODE === 'guard') {
    const input = readStdin()
    const cmd = String(input.tool_input?.command ?? '')
    if (!cmd || !DESTRUCTIVE.test(cmd)) process.exit(0)
    // 実行しようとしたコマンドそのものを残す。あとで「何をして壊れたか」を辿れるようにする
    context = cmd
    reason = 'pre-destructive'
} else if (MODE === 'session') {
    reason = 'session-start'
    context = 'セッション開始'
}

const out = run(reason, minAge, context)
if (!out.startsWith('backup-local-db: C:')) process.exit(0)

const file = out.replace('backup-local-db: ', '')
const label = MODE === 'guard' ? 'DBを変更しうるコマンドを検知したため、実行前に' : ''
console.log(
    JSON.stringify({
        systemMessage: `${label}ローカルDBをバックアップしました: ${file}`,
    })
)
