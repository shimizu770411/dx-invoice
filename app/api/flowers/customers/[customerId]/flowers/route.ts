import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { recordOperationLog } from '@/lib/operationLog'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'
import * as crypto from 'crypto'

function generateBillToKey(name: string, address: string, tel?: string): string {
    const data = `${name}|${address}|${tel || ''}`
    return crypto.createHash('sha256').update(data).digest('hex')
}

// 供花一覧（フラット）
export async function GET(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { customerId } = params

        const flowers = await prisma.flower.findMany({
            where: { customerId: BigInt(customerId) },
            include: {
                billingTargetItems: {
                    include: { flowerBillingTarget: true },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        const result = flowers.map((f) => ({
            id: f.id.toString(),
            customerId: f.customerId.toString(),
            requesterName: f.requesterName,
            labelName: f.labelName,
            jointNames: f.jointNames,
            billToName: f.billToName,
            billToAddress: f.billToAddress,
            billToTel: f.billToTel,
            deliveryTo: f.deliveryTo,
            amount: f.amount,
            flowerBillingTargetId: f.billingTargetItems[0]?.flowerBillingTarget.id.toString() ?? null,
        }))

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get flowers error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

// 供花の新規登録（請求先IDが必須）
export async function POST(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { customerId } = params
        const data = await request.json()

        let target

        if (data.flowerBillingTargetId) {
            // 請求先が選択された場合: 同一 customer に属するか確認
            target = await prisma.flowerBillingTarget.findFirst({
                where: {
                    id: BigInt(data.flowerBillingTargetId),
                    customerId: BigInt(customerId),
                },
            })
            if (!target) {
                return NextResponse.json({ error: '請求先が見つかりません' }, { status: 404 })
            }
        } else {
            // 請求先未選択時: 入力情報から自動作成（同一キーがあれば upsert）
            const billToKey = generateBillToKey(data.billToName, data.billToAddress, data.billToTel)
            target = await prisma.flowerBillingTarget.upsert({
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
        }

        // 供花を作成
        const flower = await prisma.flower.create({
            data: {
                customerId: BigInt(customerId),
                requesterName: data.requesterName,
                labelName: data.labelName || null,
                jointNames: data.jointNames || null,
                billToName: data.billToName ?? target.billToName,
                billToAddress: data.billToAddress ?? target.billToAddress,
                billToTel: data.billToTel ?? target.billToTel,
                deliveryTo: data.deliveryTo || null,
                amount: data.amount || 0,
            },
        })

        // 中間テーブルに紐付け
        await prisma.flowerBillingTargetItem.create({
            data: {
                flowerBillingTargetId: target.id,
                flowerId: flower.id,
            },
        })

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.CREATE,
            entityType: OperationEntityType.FLOWER,
            entityId: flower.id,
        })

        return NextResponse.json(
            serializeBigInt({
                ...flower,
                id: flower.id.toString(),
                customerId: flower.customerId.toString(),
                flowerBillingTargetId: target.id.toString(),
            })
        )
    } catch (error: any) {
        console.error('Create flower error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
