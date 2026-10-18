import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { getCaseDeletionSummary } from '@/lib/caseDeletion'

/**
 * 案件を削除したときに一緒に消える件数（削除前の確認メッセージ用・管理者のみ）。
 * 返り値: { receptionNo, deceasedName, summary: { テーブル名: 件数 } }
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const customerId = BigInt(params.id)
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { receptionNo: true, deceasedName: true },
        })
        if (!customer) {
            return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
        }

        const summary = await getCaseDeletionSummary(prisma, customerId)
        return NextResponse.json({ ...customer, summary })
    } catch (error: any) {
        console.error('Get case deletion summary error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
