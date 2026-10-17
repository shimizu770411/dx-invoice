import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { SET_CHILD_FIELDS, diffCollection } from '@/lib/masterChangeDiff'
import { MasterChangeAction, MasterChangeTargetType, recordMasterChange } from '@/lib/masterChangeLog'

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
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const childIds: string[] = Array.isArray(body.childIds) ? body.childIds : []

        const parentId = BigInt(params.id)
        await prisma.$transaction(async (tx) => {
            const loadLinks = async () =>
                (
                    await tx.productSet.findMany({
                        where: { parentId },
                        include: { child: { select: { name: true } } },
                        orderBy: { sortNo: 'asc' },
                    })
                ).map((l) => ({ childId: l.childId.toString(), name: l.child.name, sortNo: l.sortNo }))
            const before = await loadLinks()

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

            const parent = await tx.productItem.findUnique({ where: { id: parentId }, select: { name: true } })
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT_SET,
                action: MasterChangeAction.UPDATE,
                targetId: parentId,
                targetName: parent?.name ?? '',
                changes: diffCollection(before, await loadLinks(), {
                    key: (l) => l.childId,
                    subject: (l) => `子商品「${l.name}」`,
                    defs: SET_CHILD_FIELDS,
                }),
            })
        })

        return NextResponse.json({ ok: true, count: childIds.length })
    } catch (error: any) {
        console.error('Set product children error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
