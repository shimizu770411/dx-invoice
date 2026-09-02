import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { renderPdfFromPage } from '@/lib/puppeteer'

/** Vercel Serverless 最大実行時間（秒） */
export const maxDuration = 60

export async function GET(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params

    // JWT 認証チェック
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { customerId } = params
    const dateStr = new Date().toISOString().split('T')[0]

    return renderPdfFromPage({
        request,
        pageUrl: `${request.nextUrl.origin}/pdf/flower-invoice/${customerId}`,
        contentElementId: 'flower-invoice-pdf-content',
        filename: `供花請求書_${customerId}_${dateStr}.pdf`,
    })
}
