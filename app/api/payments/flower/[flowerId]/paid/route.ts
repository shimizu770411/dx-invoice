import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calcFlowerAmountWithTax } from '@/lib/flowerTotals'
import { isFlowerPaid } from '@/lib/flowerPayment'

// 供花1件の入金完了。金額は供花の税込額（請求書・領収書・画面と同じ計算）
export async function POST(request: NextRequest, props: { params: Promise<{ flowerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const flowerId = BigInt(params.flowerId)
        const userId = authResult.payload.sub

        const result = await prisma.$transaction(async (tx) => {
            const flower = await tx.flower.findUnique({ where: { id: flowerId } })
            if (!flower) return { error: '供花が見つかりません', status: 404 } as const
            // 二重に入金済みを作らない
            if (await isFlowerPaid(tx, flowerId)) return { error: 'この供花はすでに入金済みです', status: 400 } as const

            const payment = await tx.payment.create({
                data: {
                    customerId: flower.customerId,
                    targetType: 'FLOWER',
                    status: 'PAID',
                    flowerId,
                    paidAt: new Date(),
                    amount: calcFlowerAmountWithTax(flower.amount),
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
        console.error('Create flower payment error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
