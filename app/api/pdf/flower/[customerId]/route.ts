import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getBrowser, createJstPage } from '@/lib/puppeteer'

/** Vercel Serverless 最大実行時間（秒） */
export const maxDuration = 60

/** リクエストヘッダーの Cookie 文字列を Map に変換 */
function parseCookieHeader(header: string): Record<string, string> {
    return Object.fromEntries(
        header.split(';').map((c) => {
            const [k, ...v] = c.trim().split('=')
            return [k.trim(), v.join('=')]
        })
    )
}

export async function GET(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params

    // JWT 認証チェック
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { customerId } = params

    // アプリの Origin と PDF ページ URL を構築
    const origin = request.nextUrl.origin
    const pageUrl = `${origin}/pdf/flower/${customerId}`

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
        await page.evaluate(() => {
            const content = document.getElementById('flower-pdf-content')
            if (content) {
                document.body.innerHTML = content.outerHTML
                ;(document.body.style as CSSStyleDeclaration).margin = '0'
                ;(document.body.style as CSSStyleDeclaration).padding = '0'
            }
        })

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '32px', bottom: '32px', left: '32px', right: '32px' },
        })
        await page.close()

        const isDownload = request.nextUrl.searchParams.has('download')
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `供花請求書_${customerId}_${dateStr}.pdf`

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
