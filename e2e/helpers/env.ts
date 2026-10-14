// 通しテスト（E2E）の実行環境。
// このテストはテスト用の案件・見積・請求書をDBに作って消すため、ローカルの開発用DB以外で
// 動くと本番データを書き換えてしまう。接続先がローカルと確認できない限り、何もせずに止める。

// ローカルの開発用コンテナ（docker compose）で使っているDBのホスト名
const LOCAL_DB_HOSTS = ['postgres', 'localhost', '127.0.0.1', 'phoenix-jpn-db']

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH ?? '/usr/bin/chromium'

// テスト用の案件の故人名に付ける接頭辞。後片付けはこの接頭辞と作成したIDの両方で絞る
export const E2E_NAME_PREFIX = 'E2Eテスト_'

export function assertLocalEnvironment(): void {
    const dbUrl = process.env.DATABASE_URL ?? ''
    let host = ''
    try {
        host = new URL(dbUrl).hostname
    } catch {
        throw new Error('E2E: DATABASE_URL を解釈できないため中止しました')
    }
    if (!LOCAL_DB_HOSTS.includes(host)) {
        throw new Error(`E2E: 接続先DB（${host}）がローカルではないため中止しました`)
    }
    const appHost = new URL(BASE_URL).hostname
    if (!['localhost', '127.0.0.1'].includes(appHost)) {
        throw new Error(`E2E: 操作先の画面（${appHost}）がローカルではないため中止しました`)
    }
}
