import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { LATEST_FLOWER_PAYMENT_INCLUDE, toFlowerPaymentState } from '@/lib/flowerPayment'
import * as crypto from 'crypto'

function generateBillToKey(name: string, address: string, tel?: string): string {
    const data = `${name}|${address}|${tel || ''}`
    return crypto.createHash('sha256').update(data).digest('hex')
}

// 請求先一覧（供花込み）
export async function GET(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { customerId } = params

        const targets = await prisma.flowerBillingTarget.findMany({
            where: { customerId: BigInt(customerId) },
            include: {
                items: {
                    include: { flower: { include: LATEST_FLOWER_PAYMENT_INCLUDE } },
                    orderBy: { id: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        })

        // 入金は供花1件ごと。請求先の入金状況は画面側で供花から求める（lib/flowerTotals.ts）
        const result = targets.map((target) => ({
            id: target.id.toString(),
            customerId: target.customerId.toString(),
            billToName: target.billToName,
            billToAddress: target.billToAddress,
            billToTel: target.billToTel,
            billToKey: target.billToKey,
            flowers: target.items.map(({ flower: { payments, ...flower } }) => ({
                ...flower,
                id: flower.id.toString(),
                customerId: flower.customerId.toString(),
                ...toFlowerPaymentState(payments),
            })),
        }))

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get billing targets error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

// 請求先の新規登録
export async function POST(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { customerId } = params
        const data = await request.json()

        const billToKey = generateBillToKey(data.billToName, data.billToAddress, data.billToTel)

        const target = await prisma.flowerBillingTarget.upsert({
            where: {
                customerId_billToKey: {
                    customerId: BigInt(customerId),
                    billToKey,
                },
            },
            update: {
                billToName: data.billToName,
                billToAddress: data.billToAddress,
                billToTel: data.billToTel ?? null,
            },
            create: {
                customerId: BigInt(customerId),
                billToName: data.billToName,
                billToAddress: data.billToAddress,
                billToTel: data.billToTel ?? null,
                billToKey,
            },
        })

        return NextResponse.json(
            serializeBigInt({
                id: target.id.toString(),
                customerId: target.customerId.toString(),
                billToName: target.billToName,
                billToAddress: target.billToAddress,
                billToTel: target.billToTel,
            })
        )
    } catch (error: any) {
        console.error('Create billing target error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
