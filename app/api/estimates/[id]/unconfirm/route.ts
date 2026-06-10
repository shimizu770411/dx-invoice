import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

/**
 * 確定済み見積を DRAFT に戻す（確定解除）。
 * 明細はそのまま保持し、status のみ更新する。
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { id } = params
        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(id) },
        })
        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }
        if (estimate.status !== 'CONFIRMED') {
            return NextResponse.json(
                { error: 'この見積は確定状態ではありません' },
                { status: 400 }
            )
        }

        const updated = await prisma.estimate.update({
            where: { id: BigInt(id) },
            data: { status: 'DRAFT' },
        })

        return NextResponse.json(
            serializeBigInt({
                ...updated,
                id: updated.id.toString(),
                customerId: updated.customerId.toString(),
            })
        )
    } catch (error: any) {
        console.error('Unconfirm estimate error:', error)
        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        )
    }
}
