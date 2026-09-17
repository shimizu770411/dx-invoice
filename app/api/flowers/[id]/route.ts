import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { recordOperationLog } from '@/lib/operationLog'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params

        // 供花を取得
        const flower = await prisma.flower.findUnique({
            where: { id: BigInt(id) },
        })

        if (!flower) {
            return NextResponse.json({ error: '供花が見つかりません' }, { status: 404 })
        }

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...flower,
                id: flower.id.toString(),
                customerId: flower.customerId.toString(),
            })
        )
    } catch (error: any) {
        console.error('Get flower error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params
        const data = await request.json()

        // 供花を取得
        const flower = await prisma.flower.findUnique({
            where: { id: BigInt(id) },
            include: {
                billingTargetItems: { take: 1 },
            },
        })

        if (!flower) {
            return NextResponse.json({ error: '供花が見つかりません' }, { status: 404 })
        }

        // 供花の更新と請求先の紐付け替えは必ずまとめて行う。紐付けは「削除してから作り直す」ため、
        // 途中で失敗するとどの請求先にも属さない供花が残る
        const updated = await prisma.$transaction(async (tx) => {
            // 供花を更新
            const saved = await tx.flower.update({
                where: { id: BigInt(id) },
                data: {
                    requesterName: data.requesterName,
                    labelName: data.labelName || null,
                    jointNames: data.jointNames || null,
                    billToName: data.billToName,
                    billToAddress: data.billToAddress,
                    billToTel: data.billToTel || null,
                    deliveryTo: data.deliveryTo || null,
                    amount: data.amount || 0,
                },
            })

            // 請求先が変更された場合、中間テーブルを更新
            if (data.flowerBillingTargetId) {
                const newTargetId = BigInt(data.flowerBillingTargetId)
                const currentTargetId = flower.billingTargetItems[0]?.flowerBillingTargetId

                if (!currentTargetId || currentTargetId !== newTargetId) {
                    // 既存の紐付けを削除
                    await tx.flowerBillingTargetItem.deleteMany({
                        where: { flowerId: BigInt(id) },
                    })
                    // 新しい紐付けを作成
                    await tx.flowerBillingTargetItem.create({
                        data: {
                            flowerBillingTargetId: newTargetId,
                            flowerId: BigInt(id),
                        },
                    })
                }
            }

            return saved
        })

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.UPDATE,
            entityType: OperationEntityType.FLOWER,
            entityId: updated.id,
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...updated,
                id: updated.id.toString(),
                customerId: updated.customerId.toString(),
                flowerBillingTargetId: data.flowerBillingTargetId ?? null,
            })
        )
    } catch (error: any) {
        console.error('Update flower error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params

        // 供花を取得
        const flower = await prisma.flower.findUnique({
            where: { id: BigInt(id) },
        })

        if (!flower) {
            return NextResponse.json({ error: '供花が見つかりません' }, { status: 404 })
        }

        // 紐付けの削除と供花の削除は必ずまとめて行う。
        // 紐付けだけ消えて供花が残ると、どの請求先にも属さない供花になり請求から漏れる
        await prisma.$transaction(async (tx) => {
            await tx.flowerBillingTargetItem.deleteMany({
                where: { flowerId: BigInt(id) },
            })
            await tx.flower.delete({
                where: { id: BigInt(id) },
            })
        })

        // レスポンスを返す
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete flower error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
