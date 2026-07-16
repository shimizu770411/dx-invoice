import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { getOperationLogReport, parseReportDateRange } from '@/lib/operationLogReport'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { searchParams } = new URL(request.url)
        const range = parseReportDateRange(searchParams)
        if (!range) {
            return NextResponse.json({ error: 'from, to は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
        }

        const rows = await getOperationLogReport(range.from, range.to)
        return NextResponse.json(rows)
    } catch (error: any) {
        console.error('Get operation log report error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
