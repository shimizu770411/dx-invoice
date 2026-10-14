// Stop フックから呼ぶ、作業中のコードの自動バックアップ。
// 作業ツリー全体（未追跡ファイルを含む。.gitignore 対象は除く）のスナップショットを、
// バックアップ専用ブランチ auto-backup にコミットして personal へ push する。
//
// 2026-10-14 まではこのフックが main に直接コミットしていたが、
//   ・作業途中の状態が main に入り、そのまま origin へ push すると本番に出る
//   ・説明のないコミットに複数の作業が混ざり、機能単位で戻せない
// ため、main・作業ツリー・インデックスには一切触れない形に変えた。
// 専用の一時インデックスで木を作り、ブランチの参照だけを進める。
//
// 使い方: node hook-git-snapshot.mjs
// 失敗やスキップの理由は systemMessage で画面に出す（黙って失敗しない）。

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRANCH = 'auto-backup'
const REMOTE = 'personal'
const PUSH_TIMEOUT_MS = 40_000

// GitHub に上げてはいけないものの名前。DBダンプ・接続文字列・鍵・環境変数ファイル
const FORBIDDEN = /(\.sql|\.dump|\.backup|\.bak|\.pem|\.key|\.p12|\.pfx)$|(^|\/)\.env($|\.)|prod_url|db-backups\//i

function git(args, env) {
    return execFileSync('git', args, {
        cwd: REPO,
        encoding: 'utf8',
        env: env ? { ...process.env, ...env } : process.env,
        timeout: PUSH_TIMEOUT_MS,
        // 改行コードの警告などを画面に流さない（失敗時の内容はエラーオブジェクトに残る）
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

function tryGit(args, env) {
    try {
        return git(args, env)
    } catch {
        return null
    }
}

function report(message) {
    process.stdout.write(JSON.stringify({ systemMessage: `[auto-backup] ${message}` }))
}

function main() {
    const head = tryGit(['rev-parse', '--verify', 'HEAD'])
    if (!head) return

    // 一時インデックスに HEAD を読み込み、作業ツリーの全変更を載せる（本物のインデックスは触らない）
    const tmpIndex = join(REPO, '.git', 'auto-backup-index')
    const env = { GIT_INDEX_FILE: tmpIndex }
    try {
        git(['read-tree', head], env)
        git(['add', '-A'], env)

        const changed = git(['diff', '--cached', '--name-only', head], env)
            .split('\n')
            .filter(Boolean)
        if (changed.length === 0) return // HEAD から変わっていなければ何もしない

        const blocked = changed.filter((f) => FORBIDDEN.test(f))
        if (blocked.length > 0) {
            report(`DBダンプ等が含まれるためバックアップを中止しました: ${blocked.join(', ')}`)
            return
        }

        const tree = git(['write-tree'], env)
        const prev = tryGit(['rev-parse', '--verify', `refs/heads/${BRANCH}`])
        // 直前のスナップショットと中身が同じなら積まない
        if (prev && tryGit(['rev-parse', `${prev}^{tree}`]) === tree) return

        // 親は「直前のスナップショット」と「その時点の HEAD」。どの main から派生した作業か後で追える
        const parents = prev && prev !== head ? ['-p', prev, '-p', head] : ['-p', head]
        const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
        const commit = git(['commit-tree', tree, ...parents, '-m', `Auto-backup: ${stamp}`])
        git(['update-ref', `refs/heads/${BRANCH}`, commit])

        if (tryGit(['push', '--quiet', REMOTE, `refs/heads/${BRANCH}:refs/heads/${BRANCH}`]) === null) {
            report(`${REMOTE} への push に失敗しました（ローカルの ${BRANCH} ブランチには保存済み）`)
        }
    } catch (error) {
        report(`バックアップに失敗しました: ${error?.message?.split('\n')[0] ?? error}`)
    } finally {
        if (existsSync(tmpIndex)) rmSync(tmpIndex, { force: true })
    }
}

main()
