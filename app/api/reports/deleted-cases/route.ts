import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@phoenix-jpn/db'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { parseReportDateRange } from '@/lib/operationLogReport'

// 期間を広く取った場合でも画面が重くならないよう、新しい順にこの件数までに抑える
const MAX_ROWS = 500

/**
 * 削除した案件の履歴（管理者のみ）。保存したデータ一式（snapshot）は返さない。
 * query: from, to (YYYY-MM-DD・必須) / keyword（受付番号・故人名・喪主名の部分一致）
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const { searchParams } = new URL(request.url)
        const range = parseReportDateRange(searchParams)
        if (!range) {
            return NextResponse.json({ error: 'from, to は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
        }
        const keyword = searchParams.get('keyword')?.trim()

        const where: Prisma.DeletedCaseWhereInput = {
            deletedAt: { gte: range.from, lt: range.to },
            ...(keyword
                ? {
                      OR: [
                          { receptionNo: { contains: keyword } },
                          { deceasedName: { contains: keyword } },
                          { chiefMournerName: { contains: keyword } },
                      ],
                  }
                : {}),
        }

        const rows = await prisma.deletedCase.findMany({
            where,
            select: {
                id: true,
                originalCustomerId: true,
                receptionNo: true,
                deceasedName: true,
                chiefMournerName: true,
                summary: true,
                deletedAt: true,
                deletedBy: { select: { name: true } },
            },
            orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
            take: MAX_ROWS,
        })

        return NextResponse.json(
            serializeBigInt(rows.map(({ deletedBy, ...row }) => ({ ...row, deletedByName: deletedBy?.name ?? null })))
        )
    } catch (error: any) {
        console.error('Get deleted cases error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
