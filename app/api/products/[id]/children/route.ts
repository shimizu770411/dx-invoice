import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

/**
 * 親商品に紐づく子商品一覧を取得 (GET) または一括設定 (PUT)
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const links = await prisma.productSet.findMany({
            where: { parentId: BigInt(params.id) },
            include: { child: { select: { id: true, name: true, sortNo: true } } },
            orderBy: { sortNo: 'asc' },
        })
        return NextResponse.json(serializeBigInt(links.map((l: any) => l.child)))
    } catch (error: any) {
        console.error('Get product children error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const childIds: string[] = Array.isArray(body.childIds) ? body.childIds : []

        const parentId = BigInt(params.id)
        await prisma.$transaction(async (tx) => {
            await tx.productSet.deleteMany({ where: { parentId } })
            if (childIds.length > 0) {
                await tx.productSet.createMany({
                    data: childIds.map((cid, i) => ({
                        parentId,
                        childId: BigInt(cid),
                        sortNo: i + 1,
                    })),
                })
            }
        })

        return NextResponse.json({ ok: true, count: childIds.length })
    } catch (error: any) {
        console.error('Set product children error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
