import puppeteer, { type Browser } from 'puppeteer-core'

/**
 * Puppeteer ブラウザインスタンスを取得する
 *
 * - ローカル開発: システムの Chrome を使用 (OS を自動判定)
 *   環境変数 CHROME_EXECUTABLE_PATH で実行パスを上書き可能
 *
 * - Vercel / 本番: @sparticuz/chromium-min を使用
 *   環境変数 CHROMIUM_REMOTE_EXEC_PATH に Chromium の tar URL を設定してください
 *   例: https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar
 */
function getDefaultChromePath(): string {
    switch (process.platform) {
        case 'win32':
            return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        case 'darwin':
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        default:
            return '/usr/bin/google-chrome'
    }
}

export async function getBrowser(): Promise<Browser> {
    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
        const executablePath = process.env.CHROME_EXECUTABLE_PATH || getDefaultChromePath()

        return puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
    }

    // Vercel / 本番環境
    const chromium = (await import('@sparticuz/chromium-min')).default
    const executablePath = await chromium.executablePath(process.env.CHROMIUM_REMOTE_EXEC_PATH ?? '')

    return puppeteer.launch({
        executablePath,
        headless: true,
        args: chromium.args,
    })
}
