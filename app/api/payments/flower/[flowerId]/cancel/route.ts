import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

// 供花1件の入金取消。入金記録は消さず、取消の記録を追加する（最新の記録が取消なら未入金）
export async function POST(request: NextRequest, props: { params: Promise<{ flowerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const flowerId = BigInt(params.flowerId)
        const userId = authResult.payload.sub

        const result = await prisma.$transaction(async (tx) => {
            const latestPayment = await tx.payment.findFirst({
                where: { targetType: 'FLOWER', flowerId },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            })
            if (!latestPayment || latestPayment.status !== 'PAID') {
                return { error: '入金済みのレコードが見つかりません', status: 400 } as const
            }

            const payment = await tx.payment.create({
                data: {
                    customerId: latestPayment.customerId,
                    targetType: 'FLOWER',
                    status: 'CANCELLED',
                    flowerId,
                    paidAt: new Date(),
                    amount: latestPayment.amount,
                    memo: '入金取消',
                    createdById: userId ? BigInt(userId) : null,
                },
            })
            return { payment }
        })

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status })
        }
        return NextResponse.json(serializeBigInt(result.payment))
    } catch (error: any) {
        console.error('Cancel flower payment error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
