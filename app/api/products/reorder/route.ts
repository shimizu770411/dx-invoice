import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

/**
 * 商品の並び順を一括更新。
 * body: { ids: string[] } - 配列の並び順で sort_no を 1, 2, 3, ... に採番
 */
export async function PUT(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const ids = Array.isArray(body.ids) ? body.ids : null
        if (!ids || ids.some((v: any) => !v)) {
            return NextResponse.json({ error: 'ids is required (non-empty string[])' }, { status: 400 })
        }

        await prisma.$transaction(
            ids.map((id: string, index: number) =>
                prisma.productItem.update({
                    where: { id: BigInt(id) },
                    data: { sortNo: index + 1 },
                })
            )
        )

        return NextResponse.json({ ok: true, count: ids.length })
    } catch (error: any) {
        console.error('Reorder products error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
