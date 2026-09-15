import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals } from '@/lib/documentTotals'
import { isValidDocNo, toNullableAmount } from '@/lib/documentUtils'
import { recordOperationLog } from '@/lib/operationLog'
import { loadProductNameLookup, pickProductItemName, pickProductVariantName } from '@/lib/documentItemNames'
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

        // 請求書を取得
        const invoice = await prisma.invoice.findUnique({
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
                                // 商品マスタから消えた商品の明細も表示できるよう、
                                // 種類一覧も明細に添えて返す（種類名の引き当てに使う）
                                variants: {
                                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                                },
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
                staffConfirmedBy: { select: { id: true, name: true } },
                clerkConfirmedBy: { select: { id: true, name: true } },
                approverConfirmedBy: { select: { id: true, name: true } },
                payments: {
                    where: { targetType: 'INVOICE' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        })

        if (!invoice) {
            return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
        }

        const isPaid = invoice.payments[0]?.status === 'PAID'

        // 会費入金額を計算
        const membershipPaidAmount = invoice.customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        // レスポンスを返す
        const allFreeItems = invoice.items.flatMap((item: any) =>
            (item.freeItems || []).map((fi: any) => ({
                ...fi,
                id: fi.id.toString(),
                invoiceItemId: fi.invoiceItemId.toString(),
                parentProductItemId: fi.parentProductItemId?.toString() ?? null,
            }))
        )
        return NextResponse.json(
            serializeBigInt({
                ...invoice,
                id: invoice.id.toString(),
                customerId: invoice.customerId.toString(),
                fromEstimateId: invoice.fromEstimateId?.toString(),
                customer: {
                    ...invoice.customer,
                    id: invoice.customer.id.toString(),
                    memberships: invoice.customer.memberships.map((m: any) => ({
                        ...m,
                        id: m.id.toString(),
                        customerId: m.customerId.toString(),
                    })),
                },
                membershipPaidAmount,
                isPaid,
                payments: undefined,
                freeItems: allFreeItems,
                items: invoice.items.map((item: any) => ({
                    ...item,
                    id: item.id.toString(),
                    invoiceId: item.invoiceId.toString(),
                    productItemId: item.productItemId?.toString(),
                    productVariantId: item.productVariantId?.toString(),
                    freeItems: undefined,
                })),
            })
        )
    } catch (error: any) {
        console.error('Get invoice error:', error)
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
                { error: '請求番号は空欄、または9桁の数字（例: 202607001）で入力してください' },
                { status: 400 }
            )
        }

        if (data.docNo) {
            const duplicate = await prisma.invoice.findUnique({ where: { docNo: data.docNo } })
            if (duplicate && duplicate.id.toString() !== id) {
                return NextResponse.json(
                    { error: `請求番号「${data.docNo}」は既に他の請求書で使用されています` },
                    { status: 400 }
                )
            }
        }

        // 請求書を取得
        const invoice = await prisma.invoice.findUnique({
            where: { id: BigInt(id) },
            include: {
                customer: {
                    include: {
                        memberships: true,
                    },
                },
            },
        })

        if (!invoice) {
            return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
        }

        const membershipPaidAmount = invoice.customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

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

        // 保存時点の商品名・種類名を控えるための名称引き当て（商品マスタの改名を発行済み書類に波及させないため）
        const nameLookup = await loadProductNameLookup(data.items || [])

        await prisma.$transaction(async (tx) => {
            await tx.invoiceItem.deleteMany({
                where: { invoiceId: BigInt(id) },
            })

            const savedInvoice = await tx.invoice.update({
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
                    altarType,
                    ceilingHeight: data.ceilingHeight || null,
                    estimateStaff: data.estimateStaff || null,
                    ceremonyStaff: data.ceremonyStaff || null,
                    transportStaff: data.transportStaff || null,
                    decorationStaff: data.decorationStaff || null,
                    returnStaff: data.returnStaff || null,
                    remarks: data.remarks || null,
                    flowerFee: toNullableAmount(data.flowerFee),
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
                            productItemName: pickProductItemName(item, nameLookup),
                            productVariantName: pickProductVariantName(item, nameLookup),
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
                    items: true,
                },
            })

            const freeItems: any[] = data.freeItems || []
            if (freeItems.length > 0) {
                let anchorItemId: bigint
                if (savedInvoice.items.length > 0) {
                    anchorItemId = savedInvoice.items[0].id
                } else {
                    const dummyItem = await tx.invoiceItem.create({
                        data: {
                            invoiceId: BigInt(id),
                            unitPriceGeneral: 0,
                            unitPriceMember: 0,
                            qty: 0,
                            amount: 0,
                            sortNo: 9999,
                        },
                    })
                    anchorItemId = dummyItem.id
                }
                await tx.invoiceItemFree.createMany({
                    data: freeItems.map((item: any, index: number) => ({
                        invoiceItemId: anchorItemId,
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

            // 会員証欄（顧客レコード）も請求書の更新と同じトランザクションで保存する
            if (data.memberCardNote !== undefined) {
                const validMemberCardStatuses = ['COLLECTED', 'NOT_COLLECTED', 'LOST']
                const memberCardNote = validMemberCardStatuses.includes(data.memberCardNote)
                    ? data.memberCardNote
                    : null
                await tx.customer.update({
                    where: { id: invoice.customerId },
                    data: { memberCardNote },
                })
            }
        })

        const updated = await prisma.invoice.findUnique({
            where: { id: BigInt(id) },
            include: { customer: true, items: true },
        })

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.UPDATE,
            entityType: OperationEntityType.INVOICE,
            entityId: updated!.id,
            docNo: updated!.docNo,
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...updated,
                id: updated!.id.toString(),
                customerId: updated!.customerId.toString(),
                fromEstimateId: updated!.fromEstimateId?.toString(),
            })
        )
    } catch (error: any) {
        console.error('Update invoice error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
