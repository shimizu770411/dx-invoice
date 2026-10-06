import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals, freeItemUnitPrice, sumMembershipPaidAmount } from '@/lib/documentTotals'
import { buildDocNoPrefix, buildDocNo, pickLatestValidDocNo } from '@/lib/documentUtils'
import { recordOperationLog } from '@/lib/operationLog'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'

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

        const companyProfile = await prisma.companyProfile.findFirst()

        const membershipPaidAmount = sumMembershipPaidAmount(estimate.customer.memberships)

        const allEstimateFreeItems = estimate.items.flatMap((item: any) => item.freeItems || [])
        const totals = calculateDocumentTotals(
            estimate.items,
            membershipPaidAmount,
            allEstimateFreeItems,
            estimate.isMember
        )

        // docNo の自動採番: customers.reception_atの年月(yyyymm) + 同プレフィックスの最大連番+1(3桁)
        const prefix = buildDocNoPrefix(estimate.customer.receptionAt)
        const candidateDocs = await prisma.invoice.findMany({
            where: { docNo: { startsWith: prefix } },
            select: { docNo: true },
        })
        const latestDocNo = pickLatestValidDocNo(candidateDocs.map((d) => d.docNo))
        const autoDocNo = buildDocNo(prefix, latestDocNo)

        // 請求書本体・明細・フリー項目は必ずまとめて作成する。
        // 途中で失敗すると、フリー項目の無い請求書が残る
        const invoice = await prisma.$transaction(async (tx) => {
            const created = await tx.invoice.create({
                data: {
                    customerId: estimate.customerId,
                    planId: estimate.planId,
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
                    altarType: estimate.altarType,
                    ceilingHeight: estimate.ceilingHeight,
                    estimateStaff: estimate.estimateStaff,
                    ceremonyStaff: estimate.ceremonyStaff,
                    transportStaff: estimate.transportStaff,
                    decorationStaff: estimate.decorationStaff,
                    returnStaff: estimate.returnStaff,
                    remarks: companyProfile?.invoiceRemarksDefault ?? null,
                    items: {
                        create: estimate.items.map((item: any) => ({
                            productItemId: item.productItemId,
                            productVariantId: item.productVariantId,
                            productVariantGroupId: item.productVariantGroupId,
                            productRowId: item.productRowId,
                            productRowVariantId: item.productRowVariantId,
                            // 保存時点の商品名・種類名は、見積で控えた内容をそのまま引き継ぐ
                            productItemName: item.productItemName ?? null,
                            productVariantName: item.productVariantName ?? null,
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
                            // 0 円扱いの控えは発行時点の判断なので、引き継ぎ先でも作り直さずそのまま持ち回る
                            noChargeScope: item.noChargeScope ?? null,
                            noChargeReason: item.noChargeReason ?? null,
                            multiSelectVariantIds: (item as any).multiSelectVariantIds || null,
                            // 親祭壇の増額も引き継ぐ。unitPriceMember は上乗せ済みの金額をそのままコピーしている
                            surchargeAmount: (item as any).surchargeAmount ?? null,
                            planSurchargeId: (item as any).planSurchargeId ?? null,
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
                if (created.items.length > 0) {
                    anchorItemId = created.items[0].id
                } else {
                    const dummyItem = await tx.invoiceItem.create({
                        data: {
                            invoiceId: created.id,
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
                    data: allEstimateFreeItems.map((item: any, index: number) => ({
                        invoiceItemId: anchorItemId,
                        parentProductItemId: item.parentProductItemId
                            ? BigInt(item.parentProductItemId)
                            : null,
                        productItemName: item.productItemName || '',
                        description: item.description || '',
                        unitPriceGeneral: item.unitPriceGeneral || 0,
                        unitPriceMember: item.unitPriceMember || 0,
                        qty: item.qty || 1,
                        amount: freeItemUnitPrice(item, estimate.isMember) * (item.qty || 1),
                        sortNo: item.sortNo ?? index,
                    })),
                })
            }

            return created
        })

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.CREATE,
            entityType: OperationEntityType.INVOICE,
            entityId: invoice.id,
            docNo: invoice.docNo,
        })

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
