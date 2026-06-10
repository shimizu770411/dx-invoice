import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const product = await prisma.productItem.findUnique({
            where: { id: BigInt(params.id) },
            include: {
                variants: {
                    include: { store: true },
                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                },
                setParentLinks: {
                    include: { child: { select: { id: true, name: true, sortNo: true } } },
                    orderBy: { sortNo: 'asc' },
                },
            },
        })
        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }
        const enriched = {
            ...product,
            children: (product as any).setParentLinks?.map((l: any) => l.child) || [],
            setParentLinks: undefined,
        }
        return NextResponse.json(serializeBigInt(enriched))
    } catch (error: any) {
        console.error('Get product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }

        const updateData: any = { name: body.name }
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
        if (body.isSetParent !== undefined) updateData.isSetParent = Boolean(body.isSetParent)
        if (body.isSetChild !== undefined) updateData.isSetChild = Boolean(body.isSetChild)
        if (body.isServiceable !== undefined) updateData.isServiceable = Boolean(body.isServiceable)
        if (body.isMaturityServiceable !== undefined)
            updateData.isMaturityServiceable = Boolean(body.isMaturityServiceable)
        if (body.defaultDescription !== undefined)
            updateData.defaultDescription = body.defaultDescription || null

        const updated = await prisma.productItem.update({
            where: { id: BigInt(params.id) },
            data: updateData,
            include: { variants: true },
        })

        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Update product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const productId = BigInt(params.id)

        // 使用履歴（見積・請求の明細）チェック。履歴があれば物理削除不可
        const [estimateRefs, invoiceRefs] = await Promise.all([
            prisma.estimateItem.count({ where: { productItemId: productId } }),
            prisma.invoiceItem.count({ where: { productItemId: productId } }),
        ])
        if (estimateRefs + invoiceRefs > 0) {
            return NextResponse.json(
                {
                    error: 'BadRequest',
                    message:
                        'この商品は見積または請求書の明細で使用されているため、削除できません。代わりに「非表示」にしてください。',
                },
                { status: 400 }
            )
        }

        // 関連レコードと商品本体を物理削除（トランザクション）
        await prisma.$transaction(async (tx) => {
            // 親子セット関係を削除
            await tx.productSet.deleteMany({
                where: { OR: [{ parentId: productId }, { childId: productId }] },
            })
            // バリアント（種類）を削除
            await tx.productVariant.deleteMany({
                where: { productItemId: productId },
            })
            // 商品本体を削除
            await tx.productItem.delete({ where: { id: productId } })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
