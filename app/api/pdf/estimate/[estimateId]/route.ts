import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getBrowser, createJstPage } from '@/lib/puppeteer'
import { PDF_VIEWPORT_WIDTH_PX, PDF_VIEWPORT_HEIGHT_PX } from '@/app/(protected)/pdf/components/pdfLayoutConstants'

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

export async function GET(request: NextRequest, props: { params: Promise<{ estimateId: string }> }) {
    const params = await props.params

    // JWT 認証チェック
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { estimateId } = params

    // アプリの Origin と PDF ページ URL を構築
    const origin = request.nextUrl.origin
    const showOptions = request.nextUrl.searchParams.get('showOptions')
    const pageUrl = `${origin}/pdf/estimate/${estimateId}${
        showOptions !== null ? `?showOptions=${showOptions}` : ''
    }`

    // access_token クッキーを取得し Puppeteer に引き渡す
    const cookieHeader = request.headers.get('cookie') ?? ''
    const cookies = parseCookieHeader(cookieHeader)
    const accessToken = cookies['access_token']

    const browser = await getBrowser()
    try {
        const page = await createJstPage(browser)

        // ビューポート幅をA4実寸に固定する。プレビューページ側も同じ幅で表示しており、
        // ここがズレるとテキストの折返し行数が変わり、内容依存の高さ（フッター等）が
        // プレビューと本番PDFで食い違う。
        await page.setViewport({ width: PDF_VIEWPORT_WIDTH_PX, height: PDF_VIEWPORT_HEIGHT_PX })

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

        // Webフォントの読み込み完了を待つ（コールドスタート等でネットワークが遅い場合、
        // フォールバックフォントのまま描画されて1文字ずつ均等配置のレイアウトが崩れることがあるため）
        await page.evaluateHandle('document.fonts.ready')

        // ボタン類を非表示にし、PDF コンテンツ部分だけ body に残す
        await page.evaluate(() => {
            const content = document.getElementById('estimate-pdf-content')
            if (content) {
                document.body.innerHTML = content.outerHTML
                ;(document.body.style as CSSStyleDeclaration).margin = '0'
                ;(document.body.style as CSSStyleDeclaration).padding = '16px'
            }
        })

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        })
        await page.close()

        const isDownload = request.nextUrl.searchParams.has('download')
        const dateStr = new Date().toISOString().split('T')[0]
        const filename = `見積書_${estimateId}_${dateStr}.pdf`

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': isDownload
                    ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
                    : `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error: any) {
        console.error('Estimate PDF generation error:', error)
        return NextResponse.json({ error: 'PDF生成に失敗しました', message: error.message }, { status: 500 })
    } finally {
        await browser.close()
    }
}
