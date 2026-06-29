import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals } from '@/lib/documentTotals'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params

        // 見積を取得
        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(id) },
            include: {
                customer: {
                    include: {
                        memberships: {
                            orderBy: { rowNo: 'asc' },
                        },
                    },
                },
                items: {
                    include: {
                        productItem: { include: { rows: { include: { variants: true } } } },
                        productVariant: true,
                        freeItems: {
                            orderBy: { sortNo: 'asc' },
                        },
                    },
                    orderBy: { sortNo: 'asc' },
                },
            },
        })

        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }

        // 会費入金額を計算（会員情報から）
        const membershipPaidAmount = estimate.customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        // レスポンスを返す
        // freeItemsをestimate直下にフラットに持たせる
        const allFreeItems = estimate.items.flatMap((item: any) =>
            (item.freeItems || []).map((fi: any) => ({
                ...fi,
                id: fi.id.toString(),
                estimateItemId: fi.estimateItemId.toString(),
                parentProductItemId: fi.parentProductItemId?.toString() ?? null,
            }))
        )
        return NextResponse.json(
            serializeBigInt({
                ...estimate,
                id: estimate.id.toString(),
                customerId: estimate.customerId.toString(),
                customer: {
                    ...estimate.customer,
                    id: estimate.customer.id.toString(),
                    memberships: estimate.customer.memberships.map((m: any) => ({
                        ...m,
                        id: m.id.toString(),
                        customerId: m.customerId.toString(),
                    })),
                },
                membershipPaidAmount,
                freeItems: allFreeItems,
                items: estimate.items.map((item: any) => ({
                    ...item,
                    id: item.id.toString(),
                    estimateId: item.estimateId.toString(),
                    productItemId: item.productItemId?.toString(),
                    productVariantId: item.productVariantId?.toString(),
                    freeItems: undefined,
                    productItem: item.productItem
                        ? {
                              ...item.productItem,
                              id: item.productItem.id.toString(),
                          }
                        : null,
                    productVariant: item.productVariant
                        ? {
                              ...item.productVariant,
                              id: item.productVariant.id.toString(),
                              productItemId: item.productVariant.productItemId.toString(),
                          }
                        : null,
                })),
            })
        )
    } catch (error: any) {
        console.error('Get estimate error:', error)
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

        // 見積を取得
        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(id) },
            include: {
                customer: {
                    include: {
                        memberships: true,
                    },
                },
            },
        })

        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }

        // 会費入金額を再計算
        const membershipPaidAmount = estimate.customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        // 合計を再計算
        const totals = calculateDocumentTotals(data.items || [], membershipPaidAmount, data.freeItems || [])

        // enum型の値を検証・変換
        const validCremationProcessTypes = ['FAMILY', 'NEIGHBORHOOD', 'COMPANY'] as const
        const cremationProcessType =
            data.cremationProcessType && validCremationProcessTypes.includes(data.cremationProcessType as any)
                ? data.cremationProcessType
                : null

        const validAltarPlaceTypes = ['HOME', 'FUNERAL_HALL', 'OTHER'] as const
        const altarPlaceType =
            data.altarPlaceType && validAltarPlaceTypes.includes(data.altarPlaceType as any)
                ? data.altarPlaceType
                : null

        // 既存の明細削除 + 見積更新をトランザクションで実行
        const updated = await prisma.$transaction(async (tx) => {
            await tx.estimateItem.deleteMany({
                where: { estimateId: BigInt(id) },
            })
            const savedEstimate = await tx.estimate.update({
                where: { id: BigInt(id) },
                data: {
                    docNo: data.docNo || null,
                    status: data.status,
                    isMember: data.isMember === true || data.isMember === 'true',
                    subtotal: totals.subtotal,
                    tax: totals.tax,
                    total: totals.total,
                    membershipPaidAmount,
                    grandTotal: totals.grandTotal,
                    cremationProcessType,
                    altarPlaceType,
                    altarPlaceOther: data.altarPlaceOther || null,
                    ceilingHeight: data.ceilingHeight || null,
                    preConsultStaff: data.preConsultStaff || null,
                    estimateStaff: data.estimateStaff || null,
                    ceremonyStaff: data.ceremonyStaff || null,
                    transportStaff: data.transportStaff || null,
                    decorationStaff: data.decorationStaff || null,
                    returnStaff: data.returnStaff || null,
                    issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
                    items: {
                        create: (data.items || []).map((item: any, index: number) => ({
                            productItemId: item.productItemId ? BigInt(item.productItemId) : null,
                            productVariantId: item.productVariantId ? BigInt(item.productVariantId) : null,
                            productRowId: item.productRowId ? BigInt(item.productRowId) : null,
                            productRowVariantId: item.productRowVariantId
                                ? BigInt(item.productRowVariantId)
                                : null,
                            calcType:
                                item.calcType === 'FIXED' || item.calcType === 'UNIT_PRICE_X_QTY'
                                    ? item.calcType
                                    : null,
                            sign: Number(item.sign) === -1 ? -1 : 1,
                            description: item.description,
                            unitPriceGeneral: item.unitPriceGeneral || 0,
                            unitPriceMember: item.unitPriceMember || 0,
                            qty: item.qty || 0,
                            amount: item.amount || 0,
                            isService: Boolean(item.isService),
                            isMaturityService: Boolean(item.isMaturityService),
                            adhocSetScope: item.adhocSetScope ?? 'NONE',
                            multiSelectVariantIds: item.multiSelectVariantIds || null,
                            sortNo: item.sortNo ?? index,
                        })),
                    },
                },
                include: {
                    customer: true,
                    items: {
                        include: {
                            productItem: { include: { rows: { include: { variants: true } } } },
                            productVariant: true,
                        },
                    },
                },
            })

            // フリー項目を保存（最初のestimate_itemに紐付け、または独立行として）
            const freeItems: any[] = data.freeItems || []
            if (freeItems.length > 0) {
                // フリー項目の親となるestimate_itemを取得（最初のitem、またはフリー専用のdummyを作成）
                let anchorItemId: bigint
                if (savedEstimate.items.length > 0) {
                    anchorItemId = savedEstimate.items[0].id
                } else {
                    // 通常明細がない場合はフリー項目専用のダミー行を作成
                    const dummyItem = await tx.estimateItem.create({
                        data: {
                            estimateId: BigInt(id),
                            unitPriceGeneral: 0,
                            unitPriceMember: 0,
                            qty: 0,
                            amount: 0,
                            sortNo: 9999,
                        },
                    })
                    anchorItemId = dummyItem.id
                }
                await tx.estimateItemFree.createMany({
                    data: freeItems.map((item: any, index: number) => ({
                        estimateItemId: anchorItemId,
                        parentProductItemId: item.parentProductItemId
                            ? BigInt(item.parentProductItemId)
                            : null,
                        productItemName: item.productItemName || '',
                        description: item.description || '',
                        unitPriceGeneral: item.unitPriceGeneral || 0,
                        qty: item.qty || 1,
                        amount: (item.unitPriceGeneral || 0) * (item.qty || 1),
                        sortNo: item.sortNo ?? index,
                    })),
                })
            }

            return savedEstimate
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...updated,
                id: updated.id.toString(),
                customerId: updated.customerId.toString(),
            })
        )
    } catch (error: any) {
        console.error('Update estimate error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
