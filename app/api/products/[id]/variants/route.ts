import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { id } = params
        const variants = await prisma.productVariant.findMany({
            where: {
                productItemId: BigInt(id),
                isActive: true,
            },
        })

        return NextResponse.json(serializeBigInt(variants))
    } catch (error: any) {
        console.error('Get product variants error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }

        const isDefaultSet = Boolean(body.isDefaultSet)
        const productItemId = BigInt(params.id)
        const groupId = body.groupId ? BigInt(body.groupId) : null

        const created = await prisma.$transaction(async (tx) => {
            // 初期セット ON の場合、同商品の他種類の isDefaultSet を OFF に
            if (isDefaultSet) {
                await tx.productVariant.updateMany({
                    where: { productItemId },
                    data: { isDefaultSet: false },
                })
            }
            // sortNo 未指定時は末尾に追加（グループ商品はグループ単位、それ以外は商品単位で最大 sortNo + 1）
            let sortNo = Number(body.sortNo)
            if (!Number.isFinite(sortNo)) {
                const max = await tx.productVariant.aggregate({
                    where: groupId ? { groupId } : { productItemId },
                    _max: { sortNo: true },
                })
                sortNo = (max._max.sortNo ?? -1) + 1
            }
            return tx.productVariant.create({
                data: {
                    productItemId,
                    storeId: body.storeId ? BigInt(body.storeId) : null,
                    groupId,
                    name: body.name,
                    imageUrl: body.imageUrl || null,
                    priceGeneral: Number(body.priceGeneral) || 0,
                    priceMember: Number(body.priceMember) || 0,
                    setPrice: isDefaultSet ? 0 : Number(body.setPrice) || 0,
                    isDefaultSet,
                    isActive: body.isActive !== false,
                    sortNo,
                },
                include: { store: true },
            })
        })
        return NextResponse.json(serializeBigInt(created), { status: 201 })
    } catch (error: any) {
        console.error('Create variant error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
