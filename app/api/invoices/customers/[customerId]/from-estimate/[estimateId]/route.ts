import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals } from '@/lib/documentTotals'
import { buildDocNoPrefix, buildDocNo, pickLatestValidDocNo } from '@/lib/documentUtils'

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ customerId: string; estimateId: string }> }
) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { customerId, estimateId } = params

        // 見積を取得
        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(estimateId) },
            include: {
                customer: {
                    include: {
                        memberships: true,
                    },
                },
                items: {
                    include: {
                        productItem: true,
                        productVariant: true,
                        freeItems: {
                            orderBy: { sortNo: 'asc' },
                        },
                    },
                },
            },
        })

        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }

        if (estimate.customerId.toString() !== customerId) {
            return NextResponse.json({ error: '案件IDが一致しません' }, { status: 400 })
        }

        const membershipPaidAmount = estimate.customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        const allEstimateFreeItems = estimate.items.flatMap((item: any) => item.freeItems || [])
        const totals = calculateDocumentTotals(estimate.items, membershipPaidAmount, allEstimateFreeItems)

        // docNo の自動採番: customers.reception_atの年月(yyyymm) + 同プレフィックスの最大連番+1(3桁)
        const prefix = buildDocNoPrefix(estimate.customer.receptionAt)
        const candidateDocs = await prisma.invoice.findMany({
            where: { docNo: { startsWith: prefix } },
            select: { docNo: true },
        })
        const latestDocNo = pickLatestValidDocNo(candidateDocs.map((d) => d.docNo))
        const autoDocNo = buildDocNo(prefix, latestDocNo)

        const invoice = await prisma.invoice.create({
            data: {
                customerId: estimate.customerId,
                docNo: autoDocNo,
                status: 'DRAFT',
                isMember: estimate.isMember,
                subtotal: totals.subtotal,
                tax: totals.tax,
                total: totals.total,
                membershipPaidAmount,
                grandTotal: totals.grandTotal,
                fromEstimateId: BigInt(estimateId),
                cremationProcessType: estimate.cremationProcessType,
                altarPlaceType: estimate.altarPlaceType,
                altarPlaceOther: estimate.altarPlaceOther,
                ceilingHeight: estimate.ceilingHeight,
                estimateStaff: estimate.estimateStaff,
                ceremonyStaff: estimate.ceremonyStaff,
                transportStaff: estimate.transportStaff,
                decorationStaff: estimate.decorationStaff,
                returnStaff: estimate.returnStaff,
                remarks: estimate.remarks,
                items: {
                    create: estimate.items.map((item: any) => ({
                        productItemId: item.productItemId,
                        productVariantId: item.productVariantId,
                        productRowId: item.productRowId,
                        productRowVariantId: item.productRowVariantId,
                        calcType: item.calcType,
                        sign: item.sign ?? 1,
                        description: item.description,
                        unitPriceGeneral: item.unitPriceGeneral,
                        unitPriceMember: item.unitPriceMember,
                        qty: item.qty,
                        amount: item.amount,
                        isService: item.isService ?? false,
                        isMaturityService: item.isMaturityService ?? false,
                        adhocSetScope: item.adhocSetScope ?? 'NONE',
                        multiSelectVariantIds: (item as any).multiSelectVariantIds || null,
                        sortNo: item.sortNo,
                    })),
                },
            },
            include: {
                customer: true,
                items: true,
            },
        })

        // フリー項目をコピー
        if (allEstimateFreeItems.length > 0) {
            let anchorItemId: bigint
            if (invoice.items.length > 0) {
                anchorItemId = invoice.items[0].id
            } else {
                const dummyItem = await prisma.invoiceItem.create({
                    data: {
                        invoiceId: invoice.id,
                        unitPriceGeneral: 0,
                        unitPriceMember: 0,
                        qty: 0,
                        amount: 0,
                        sortNo: 9999,
                    },
                })
                anchorItemId = dummyItem.id
            }
            await prisma.invoiceItemFree.createMany({
                data: allEstimateFreeItems.map((item: any, index: number) => ({
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

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...invoice,
                id: invoice.id.toString(),
                customerId: invoice.customerId.toString(),
                fromEstimateId: invoice.fromEstimateId?.toString(),
            })
        )
    } catch (error: any) {
        console.error('Create invoice from estimate error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
