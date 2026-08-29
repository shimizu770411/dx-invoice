import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

// 事前相談見積 → 本見積（FORMAL）への確定
// ① 元レコードを PRE_CONSULTATION に固定（読み取り専用化）
// ② 全データをコピーした新レコード（FORMAL）を作成して返す
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { id } = params

        const source = await prisma.estimate.findUnique({
            where: { id: BigInt(id) },
            include: {
                items: {
                    include: { freeItems: true },
                    orderBy: { sortNo: 'asc' },
                },
            },
        })

        if (!source) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }
        if (source.estimateType !== 'PRE_CONSULTATION') {
            return NextResponse.json({ error: 'この見積はすでに本見積です' }, { status: 400 })
        }

        const newEstimate = await prisma.$transaction(async (tx) => {
            // 元レコードを読み取り専用（PRE_CONSULTATION + CONFIRMED = 本見積作成済みを示す）
            await tx.estimate.update({
                where: { id: BigInt(id) },
                data: { estimateType: 'PRE_CONSULTATION', status: 'CONFIRMED' },
            })

            // 新レコード（FORMAL）を作成
            const created = await tx.estimate.create({
                data: {
                    customerId: source.customerId,
                    docNo: null, // 本見積の docNo は別途採番
                    status: 'DRAFT',
                    estimateType: 'FORMAL',
                    isMember: source.isMember,
                    subtotal: source.subtotal,
                    tax: source.tax,
                    total: source.total,
                    membershipPaidAmount: source.membershipPaidAmount,
                    grandTotal: source.grandTotal,
                    cremationProcessType: source.cremationProcessType,
                    altarPlaceType: source.altarPlaceType,
                    altarPlaceOther: source.altarPlaceOther,
                    ceilingHeight: source.ceilingHeight,
                    preConsultStaff: source.preConsultStaff,
                    estimateStaff: source.estimateStaff,
                    ceremonyStaff: source.ceremonyStaff,
                    transportStaff: source.transportStaff,
                    decorationStaff: source.decorationStaff,
                    returnStaff: source.returnStaff,
                    remarks: source.remarks,
                    issuedAt: source.issuedAt,
                },
            })

            // 明細行をコピー
            for (const item of source.items) {
                const newItem = await tx.estimateItem.create({
                    data: {
                        estimateId: created.id,
                        productItemId: item.productItemId,
                        productVariantId: item.productVariantId,
                        productVariantGroupId: item.productVariantGroupId,
                        productRowId: item.productRowId,
                        productRowVariantId: item.productRowVariantId,
                        calcType: item.calcType,
                        sign: item.sign,
                        description: item.description,
                        unitPriceGeneral: item.unitPriceGeneral,
                        unitPriceMember: item.unitPriceMember,
                        qty: item.qty,
                        amount: item.amount,
                        isService: item.isService,
                        isMaturityService: item.isMaturityService,
                        adhocSetScope: item.adhocSetScope,
                        multiSelectVariantIds: item.multiSelectVariantIds,
                        sortNo: item.sortNo,
                    },
                })

                // フリー行もコピー
                if (item.freeItems.length > 0) {
                    await tx.estimateItemFree.createMany({
                        data: item.freeItems.map((fi) => ({
                            estimateItemId: newItem.id,
                            parentProductItemId: fi.parentProductItemId,
                            productItemName: fi.productItemName,
                            description: fi.description,
                            unitPriceGeneral: fi.unitPriceGeneral,
                            qty: fi.qty,
                            amount: fi.amount,
                            sortNo: fi.sortNo,
                        })),
                    })
                }
            }

            return created
        })

        return NextResponse.json(serializeBigInt({ id: newEstimate.id.toString() }))
    } catch (error: any) {
        console.error('Confirm estimate error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
