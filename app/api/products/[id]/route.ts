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
                rows: {
                    include: {
                        variants: {
                            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                        },
                    },
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

        const SCOPE_VALUES = ['NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const
        const normalizeScope = (v: unknown) =>
            SCOPE_VALUES.includes(v as any) ? (v as (typeof SCOPE_VALUES)[number]) : 'NONE'

        const updateData: any = { name: body.name }
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
        if (body.isSetParent !== undefined) updateData.isSetParent = Boolean(body.isSetParent)
        if (body.isSetChild !== undefined) updateData.isSetChild = Boolean(body.isSetChild)
        if (body.serviceableScope !== undefined)
            updateData.serviceableScope = normalizeScope(body.serviceableScope)
        if (body.setableScope !== undefined)
            updateData.setableScope = normalizeScope(body.setableScope)
        if (body.isMaturityServiceable !== undefined)
            updateData.isMaturityServiceable = Boolean(body.isMaturityServiceable)
        if (body.isMultiRow !== undefined) updateData.isMultiRow = Boolean(body.isMultiRow)
        if (body.canAddFreeRow !== undefined) updateData.canAddFreeRow = Boolean(body.canAddFreeRow)
        if (body.isMultiSelect !== undefined) updateData.isMultiSelect = Boolean(body.isMultiSelect)
        if (body.multiSelectMerge !== undefined) updateData.multiSelectMerge = Boolean(body.multiSelectMerge)
        if (body.defaultDescription !== undefined)
            updateData.defaultDescription = body.defaultDescription || null

        // ProductItem 自体の更新（明細行のリレーション処理は別途）
        await prisma.productItem.update({
            where: { id: BigInt(params.id) },
            data: updateData,
        })

        // 明細行構成（複数行構成商品時のみ）: body.rows があれば全置換
        if (Array.isArray(body.rows)) {
            await prisma.productRow.deleteMany({
                where: { productItemId: BigInt(params.id) },
            })
            for (const [rowIdx, row] of body.rows.entries()) {
                await prisma.productRow.create({
                    data: {
                        productItemId: BigInt(params.id),
                        label: typeof row.label === 'string' ? row.label : '',
                        calcType: row.calcType === 'FIXED' ? 'FIXED' : 'UNIT_PRICE_X_QTY',
                        defaultQty: Number.isFinite(Number(row.defaultQty))
                            ? Number(row.defaultQty)
                            : 1,
                        hasReturn: Boolean(row.hasReturn),
                        sortNo: rowIdx,
                        isActive: row.isActive !== false,
                        variants: {
                            create: (Array.isArray(row.variants) ? row.variants : []).map(
                                (v: any, vIdx: number) => ({
                                    label: typeof v.label === 'string' ? v.label : '',
                                    imageUrl:
                                        typeof v.imageUrl === 'string' && v.imageUrl
                                            ? v.imageUrl
                                            : null,
                                    unitPrice: Number.isFinite(Number(v.unitPrice))
                                        ? Number(v.unitPrice)
                                        : 0,
                                    isDefault: Boolean(v.isDefault),
                                    sortNo: vIdx,
                                    isActive: v.isActive !== false,
                                })
                            ),
                        },
                    },
                })
            }
        }

        const updated = await prisma.productItem.findUnique({
            where: { id: BigInt(params.id) },
            include: {
                variants: true,
                rows: {
                    include: { variants: { orderBy: { sortNo: 'asc' } } },
                    orderBy: { sortNo: 'asc' },
                },
            },
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
