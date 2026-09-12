import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals } from '@/lib/documentTotals'
import { isValidDocNo, toNullableAmount } from '@/lib/documentUtils'
import { recordOperationLog } from '@/lib/operationLog'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'
import { VALID_CREMATION_PROCESS_TYPES, VALID_ALTAR_PLACE_TYPES, VALID_ALTAR_TYPES } from '@/lib/documentEnums'

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
                        productItem: {
                            include: {
                                rows: { include: { variants: true } },
                                variantGroups: { include: { variants: true } },
                            },
                        },
                        productVariant: true,
                        productRow: true,
                        productRowVariant: true,
                        freeItems: {
                            orderBy: { sortNo: 'asc' },
                        },
                    },
                    orderBy: { sortNo: 'asc' },
                },
                invoices: {
                    select: { id: true },
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
                hasInvoice: estimate.invoices.length > 0,
                invoices: undefined,
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

        if (data.docNo && !isValidDocNo(data.docNo)) {
            return NextResponse.json(
                { error: '見積番号は空欄、または9桁の数字（例: 202607001）で入力してください' },
                { status: 400 }
            )
        }

        if (data.docNo) {
            const duplicate = await prisma.estimate.findUnique({ where: { docNo: data.docNo } })
            if (duplicate && duplicate.id.toString() !== id) {
                return NextResponse.json(
                    { error: `見積番号「${data.docNo}」は既に他の見積で使用されています` },
                    { status: 400 }
                )
            }
        }

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
        const cremationProcessType =
            data.cremationProcessType && VALID_CREMATION_PROCESS_TYPES.includes(data.cremationProcessType)
                ? data.cremationProcessType
                : null

        const altarPlaceType =
            data.altarPlaceType && VALID_ALTAR_PLACE_TYPES.includes(data.altarPlaceType)
                ? data.altarPlaceType
                : null

        const altarType = data.altarType && VALID_ALTAR_TYPES.includes(data.altarType) ? data.altarType : null

        // 既存の明細削除 + 見積更新をトランザクションで実行
        const updated = await prisma.$transaction(async (tx) => {
            await tx.estimateItem.deleteMany({
                where: { estimateId: BigInt(id) },
            })
            const savedEstimate = await tx.estimate.update({
                where: { id: BigInt(id) },
                data: {
                    planId: data.planId ? BigInt(data.planId) : undefined,
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
                    altarType,
                    ceilingHeight: data.ceilingHeight || null,
                    preConsultStaff: data.preConsultStaff || null,
                    estimateStaff: data.estimateStaff || null,
                    ceremonyStaff: data.ceremonyStaff || null,
                    transportStaff: data.transportStaff || null,
                    decorationStaff: data.decorationStaff || null,
                    returnStaff: data.returnStaff || null,
                    remarks: data.remarks || null,
                    cremationFee: toNullableAmount(data.cremationFee),
                    offeringFee: toNullableAmount(data.offeringFee),
                    newspaperAdFee: toNullableAmount(data.newspaperAdFee),
                    issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
                    items: {
                        create: (data.items || []).map((item: any, index: number) => ({
                            productItemId: item.productItemId ? BigInt(item.productItemId) : null,
                            productVariantId: item.productVariantId ? BigInt(item.productVariantId) : null,
                            productRowId: item.productRowId ? BigInt(item.productRowId) : null,
                            productRowVariantId: item.productRowVariantId
                                ? BigInt(item.productRowVariantId)
                                : null,
                            productVariantGroupId: item.productVariantGroupId
                                ? BigInt(item.productVariantGroupId)
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
                            // 親祭壇の増額。各単価には上乗せ済みのため、記録として保存する
                            surchargeAmount: toNullableAmount(item.surchargeAmount),
                            planSurchargeId: item.planSurchargeId ? BigInt(item.planSurchargeId) : null,
                            sortNo: item.sortNo ?? index,
                        })),
                    },
                },
                include: {
                    customer: true,
                    items: {
                        include: {
                            productItem: {
                                include: {
                                    rows: { include: { variants: true } },
                                    variantGroups: { include: { variants: true } },
                                },
                            },
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

            // 会員証欄（顧客レコード）も見積の更新と同じトランザクションで保存する
            if (data.memberCardNote !== undefined) {
                const validMemberCardStatuses = ['COLLECTED', 'NOT_COLLECTED', 'LOST']
                const memberCardNote = validMemberCardStatuses.includes(data.memberCardNote)
                    ? data.memberCardNote
                    : null
                await tx.customer.update({
                    where: { id: estimate.customerId },
                    data: { memberCardNote },
                })
            }

            return savedEstimate
        })

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.UPDATE,
            entityType: OperationEntityType.ESTIMATE,
            entityId: updated.id,
            docNo: updated.docNo,
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
