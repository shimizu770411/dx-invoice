import { defineConfig } from 'vitest/config'
import path from 'path'

// 本番データ全体の整合確認（e2e/invariants）専用の設定。
// ローカルDB（本番のコピー）にある見積・請求書をすべて画面とPDFで開いて突き合わせるため時間がかかる
// （約180件で20〜30分）。通常の通しテスト（vitest.e2e.config.mts）とは分けて、明示的に実行したときだけ動かす。
//   docker exec phoenix-jpn-vercel-dev sh -lc "cd /app && npm run test:e2e:invariants"
//   件数を絞るとき: E2E_INVARIANT_LIMIT=10 を付ける（見積・請求書をそれぞれ新しい順に10件）
const INVARIANT_TIMEOUT_MS = 2 * 60 * 60 * 1000

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['e2e/invariants/**/*.invariant.ts'],
        // 開始時に、前回テスト以降の商品マスタ・プラン設定の変更を一覧で出す（e2e/globalSetup.ts）
        globalSetup: ['e2e/globalSetup.ts'],
        fileParallelism: false,
        testTimeout: INVARIANT_TIMEOUT_MS,
        hookTimeout: 300_000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
})
