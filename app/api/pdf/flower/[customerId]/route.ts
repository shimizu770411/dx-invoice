import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { renderPdfFromPage } from '@/lib/puppeteer'
import { toJapanDateInputValue } from '@/lib/dateUtils'

/** Vercel Serverless 最大実行時間（秒） */
export const maxDuration = 60

export async function GET(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params

    // JWT 認証チェック
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { customerId } = params
    const dateStr = toJapanDateInputValue()

    return renderPdfFromPage({
        request,
        pageUrl: `${request.nextUrl.origin}/pdf/flower/${customerId}`,
        contentElementId: 'flower-pdf-content',
        filename: `供花領収書_${customerId}_${dateStr}.pdf`,
    })
}
