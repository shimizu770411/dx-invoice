import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { diffFields, formatNumber, type FieldChange, type FieldDef } from '@/lib/masterChangeDiff'
import {
    MASTER_SAVE_TX_TIMEOUT_MS,
    MasterChangeAction,
    MasterChangeTargetType,
    recordMasterChange,
} from '@/lib/masterChangeLog'

const SORT_FIELDS: FieldDef[] = [{ key: 'sortNo', label: '並び順', format: formatNumber }]

/**
 * 商品の並び順を一括更新。
 * body: { ids: string[] } - 配列の並び順で sort_no を 1, 2, 3, ... に採番
 */
export async function PUT(request: NextRequest) {
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const ids = Array.isArray(body.ids) ? body.ids : null
        if (!ids || ids.some((v: any) => !v)) {
            return NextResponse.json({ error: 'ids is required (non-empty string[])' }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
            const before = await tx.productItem.findMany({
                where: { id: { in: ids.map((id: string) => BigInt(id)) } },
                select: { id: true, name: true, sortNo: true },
            })
            const beforeMap = new Map(before.map((p) => [p.id.toString(), p]))

            const changes: FieldChange[] = []
            for (const [index, id] of ids.entries()) {
                const sortNo = index + 1
                await tx.productItem.update({
                    where: { id: BigInt(id) },
                    data: { sortNo },
                })
                const prev = beforeMap.get(String(id))
                if (prev && prev.sortNo !== sortNo) {
                    changes.push(...diffFields({ sortNo: prev.sortNo }, { sortNo }, SORT_FIELDS, prev.name))
                }
            }

            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT_ORDER,
                action: MasterChangeAction.UPDATE,
                targetId: null,
                targetName: '商品の並び順',
                changes,
            })
        }, { timeout: MASTER_SAVE_TX_TIMEOUT_MS })

        return NextResponse.json({ ok: true, count: ids.length })
    } catch (error: any) {
        console.error('Reorder products error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
