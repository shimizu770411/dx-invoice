import { defineConfig } from 'vitest/config'
import path from 'path'

// 見積・請求画面の通しテスト（E2E）専用の設定。
// ローカルの開発用コンテナ内でブラウザを自動操作し、テスト用の案件をDBに作って消すため、
// 通常の単体テスト（vitest.config.mts）とは分けて、明示的に実行したときだけ動かす。
//   docker exec phoenix-jpn-vercel-dev sh -lc "cd /app && npm run test:e2e"
const E2E_TIMEOUT_MS = 300_000

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['e2e/**/*.e2e.ts'],
        // 開始時に、前回テスト以降の商品マスタ・プラン設定の変更を一覧で出す（e2e/globalSetup.ts）
        globalSetup: ['e2e/globalSetup.ts'],
        // 同じDBと開発サーバーを使うため、並列にせず1つずつ流す
        fileParallelism: false,
        testTimeout: E2E_TIMEOUT_MS,
        hookTimeout: E2E_TIMEOUT_MS,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
})
