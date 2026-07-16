const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // TODO: 型エラー解消後に削除する（緊急デプロイ用の一時設定）
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },

    // Puppeteer / Chromium / Prisma をWebpackでバンドルしない（サーバーサイド専用）
    // Prisma は Query Engine の .so.node バイナリをバンドルできないため必須
    serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min', '@prisma/client', '.prisma/client'],

    // ワークスペースパッケージをトランスパイル
    transpilePackages: ['@phoenix-jpn/db'],

    // Prismaのバイナリファイル(.so.node)をVercelデプロイ時に確実に含めるための設定
    // schema.prismaの binaryTargets で生成されたファイルがデプロイパッケージに含まれるようにする
    outputFileTracingIncludes: {
        '/api/**/*': ['./node_modules/.prisma/client/**/*'],
        '/*': ['./node_modules/.prisma/client/**/*'],
    },

    // 環境変数
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (process.env.VERCEL ? '/api' : 'http://localhost:3000'),
        // ヘッダー色の切り替え用: Vercel本番以外（ローカル docker 等）を判定
        NEXT_PUBLIC_IS_LOCAL: process.env.VERCEL_ENV === 'production' ? 'false' : 'true',
    },

    // Turbopack設定（Next.js 16でTurbopackがデフォルトのため）
    turbopack: {},

    // Webpackの設定
    webpack: (config, { isServer }) => {
        // パスエイリアスの設定
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, '.'),
        }

        // サーバーサイドのみ
        if (isServer) {
            // ワークスペースパッケージの解決
            config.resolve.alias['@phoenix-jpn/db'] = path.resolve(__dirname, './packages/db/src/index.ts')

            // Prisma を bundle 対象から除外（.so.node バイナリ問題対策）
            config.externals = Array.isArray(config.externals)
                ? [...config.externals, '@prisma/client', '.prisma/client']
                : [config.externals, '@prisma/client', '.prisma/client'].filter(Boolean)

            // pnpm workspaces で @prisma/client がルート node_modules に無いため、
            // packages/db 配下を resolve に追加
            config.resolve.modules = [
                ...(config.resolve.modules || ['node_modules']),
                path.resolve(__dirname, 'packages/db/node_modules'),
            ]
        }

        return config
    },
}

module.exports = nextConfig
