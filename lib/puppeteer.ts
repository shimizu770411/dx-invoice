import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { NextRequest, NextResponse } from 'next/server'

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

/**
 * PDF生成用のページを作成する。
 * サーバーの実行環境（Vercel/Docker）はタイムゾーン未設定でUTC動作のため、
 * 明示的に日本時間へ固定しないと、PDF内の時刻表示（受付・通夜・出棺等）が
 * 実際の時刻より9時間ズレて印字される。
 */
export async function createJstPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage()
    await page.emulateTimezone('Asia/Tokyo')
    return page
}

/** リクエストヘッダーの Cookie 文字列を Map に変換 */
function parseCookieHeader(header: string): Record<string, string> {
    return Object.fromEntries(
        header.split(';').map((c) => {
            const [k, ...v] = c.trim().split('=')
            return [k.trim(), v.join('=')]
        })
    )
}

/**
 * アプリ内のページを Puppeteer でレンダリングし、PDF レスポンスとして返す。
 * リクエストの access_token クッキーをそのままブラウザに引き渡すことで、
 * ページ側の認証チェックを通過させる。
 */
export async function renderPdfFromPage(options: {
    request: NextRequest
    pageUrl: string
    contentElementId: string
    filename: string
}): Promise<NextResponse> {
    const { request, pageUrl, contentElementId, filename } = options
    const origin = request.nextUrl.origin

    // access_token クッキーを取得し Puppeteer に引き渡す
    const cookieHeader = request.headers.get('cookie') ?? ''
    const cookies = parseCookieHeader(cookieHeader)
    const accessToken = cookies['access_token']

    const browser = await getBrowser()
    try {
        const page = await createJstPage(browser)

        // 認証クッキーをセット
        if (accessToken) {
            await page.setCookie({
                name: 'access_token',
                value: accessToken,
                domain: new URL(origin).hostname,
                path: '/',
            })
        }

        // PDF ページに遷移しレンダリングを待つ
        await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 60000 })

        // ボタン類を非表示にし、PDF コンテンツ部分だけ body に残す
        await page.evaluate((elementId) => {
            const content = document.getElementById(elementId)
            if (content) {
                document.body.innerHTML = content.outerHTML
                ;(document.body.style as CSSStyleDeclaration).margin = '0'
                ;(document.body.style as CSSStyleDeclaration).padding = '0'
            }
        }, contentElementId)

        // Webフォントの読み込み完了を待つ（コールドスタート等でネットワークが遅い場合、
        // フォールバックフォントのまま描画されて1文字ずつ均等配置のレイアウトが崩れることがあるため）
        await page.evaluateHandle('document.fonts.ready')

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '32px', bottom: '32px', left: '32px', right: '32px' },
        })
        await page.close()

        const isDownload = request.nextUrl.searchParams.has('download')

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': isDownload
                    ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
                    : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
            },
        })
    } finally {
        await browser.close()
    }
}
