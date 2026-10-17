import { NextRequest, NextResponse } from 'next/server'
import { MasterChangeTargetType, Prisma } from '@phoenix-jpn/db'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { parseReportDateRange } from '@/lib/operationLogReport'

// 期間を広く取った場合でも画面が重くならないよう、新しい順にこの件数までに抑える
const MAX_ROWS = 500

/**
 * 商品マスタ・プラン設定の変更履歴の一覧（管理者のみ）。
 * query: from, to (YYYY-MM-DD・必須) / userId / targetType / keyword（対象名の部分一致）
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

        const userId = searchParams.get('userId')
        const targetType = searchParams.get('targetType')
        const keyword = searchParams.get('keyword')?.trim()
        if (targetType && !Object.values(MasterChangeTargetType).includes(targetType as MasterChangeTargetType)) {
            return NextResponse.json({ error: 'targetType が不正です' }, { status: 400 })
        }

        const where: Prisma.MasterChangeLogWhereInput = {
            occurredAt: { gte: range.from, lt: range.to },
            ...(userId ? { userId: BigInt(userId) } : {}),
            ...(targetType ? { targetType: targetType as MasterChangeTargetType } : {}),
            ...(keyword ? { targetName: { contains: keyword, mode: 'insensitive' } } : {}),
        }

        const logs = await prisma.masterChangeLog.findMany({
            where,
            include: { user: { select: { name: true } } },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: MAX_ROWS,
        })

        return NextResponse.json(
            serializeBigInt(
                logs.map(({ user, ...log }) => ({ ...log, userName: user?.name ?? null }))
            )
        )
    } catch (error: any) {
        console.error('Get master change logs error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
