import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { calculateDocumentTotals } from '@/lib/documentTotals'
import { buildDocNoPrefix, buildDocNo, isValidDocNo, pickLatestValidDocNo } from '@/lib/documentUtils'
import { recordOperationLog } from '@/lib/operationLog'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'
import { VALID_CREMATION_PROCESS_TYPES, VALID_ALTAR_PLACE_TYPES, VALID_ALTAR_TYPES } from '@/lib/documentEnums'

export async function GET(request: NextRequest) {
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        // クエリパラメータを取得
        const { searchParams } = new URL(request.url)
        const customerId = searchParams.get('customerId') || undefined

        console.log('GET /api/estimates - customerId:', customerId)

        // 検索条件を構築
        const where: any = {}
        if (customerId) {
            where.customerId = BigInt(customerId)
            console.log('Searching estimates for customerId:', customerId, 'as BigInt:', where.customerId.toString())
        }

        // 見積を取得
        const estimates = await prisma.estimate.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        deceasedName: true,
                        receptionAt: true,
                        chiefMournerName: true,
                        chiefMournerAddress: true,
                    },
                },
                items: {
                    include: {
                        productItem: { include: { rows: { include: { variants: true } } } },
                        productVariant: true,
                    },
                    orderBy: { sortNo: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        console.log(`Found ${estimates.length} estimates for customerId: ${customerId || 'all'}`)

        // レスポンス形式に変換
        const result = estimates.map((estimate: any) => ({
            ...estimate,
            id: estimate.id.toString(),
            customerId: estimate.customerId.toString(),
            customer: {
                ...estimate.customer,
                id: estimate.customer.id.toString(),
            },
            items: estimate.items.map((item: any) => ({
                ...item,
                id: item.id.toString(),
                estimateId: item.estimateId.toString(),
                productItemId: item.productItemId?.toString(),
                productVariantId: item.productVariantId?.toString(),
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
        }))

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get estimates error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const data = await request.json()
        const { customerId } = data

        if (!customerId) {
            return NextResponse.json({ error: 'customerId は必須です' }, { status: 400 })
        }

        if (data.docNo && !isValidDocNo(data.docNo)) {
            return NextResponse.json(
                { error: '見積番号は空欄、または9桁の数字（例: 202607001）で入力してください' },
                { status: 400 }
            )
        }

        if (data.docNo) {
            const duplicate = await prisma.estimate.findUnique({ where: { docNo: data.docNo } })
            if (duplicate) {
                return NextResponse.json(
                    { error: `見積番号「${data.docNo}」は既に他の見積で使用されています` },
                    { status: 400 }
                )
            }
        }

        // 顧客を取得
        const customer = await prisma.customer.findUnique({
            where: { id: BigInt(customerId) },
            include: { memberships: true },
        })

        if (!customer) {
            return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
        }

        // 会費入金額を計算
        const membershipPaidAmount = customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        // 合計を計算
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

        // docNo の自動採番: customers.reception_atの年月(yyyymm) + 同プレフィックスの最大連番+1(3桁)
        const prefix = buildDocNoPrefix(customer.receptionAt)
        const candidateDocs = await prisma.estimate.findMany({
            where: { docNo: { startsWith: prefix } },
            select: { docNo: true },
        })
        const latestDocNo = pickLatestValidDocNo(candidateDocs.map((d) => d.docNo))
        const docNo = buildDocNo(prefix, latestDocNo, data.docNo)

        // 見積を作成
        const estimate = await prisma.estimate.create({
            data: {
                customerId: BigInt(customerId),
                docNo,
                status: data.status || 'DRAFT',
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

        // フリー項目を保存
        const freeItems: any[] = data.freeItems || []
        if (freeItems.length > 0) {
            let anchorItemId: bigint
            if (estimate.items.length > 0) {
                anchorItemId = estimate.items[0].id
            } else {
                const dummyItem = await prisma.estimateItem.create({
                    data: {
                        estimateId: estimate.id,
                        unitPriceGeneral: 0,
                        unitPriceMember: 0,
                        qty: 0,
                        amount: 0,
                        sortNo: 9999,
                    },
                })
                anchorItemId = dummyItem.id
            }
            await prisma.estimateItemFree.createMany({
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

        // 会員証欄（顧客レコード）も見積の新規作成時に保存する
        if (data.memberCardNote !== undefined) {
            const validMemberCardStatuses = ['COLLECTED', 'NOT_COLLECTED', 'LOST']
            const memberCardNote = validMemberCardStatuses.includes(data.memberCardNote)
                ? data.memberCardNote
                : null
            await prisma.customer.update({
                where: { id: BigInt(customerId) },
                data: { memberCardNote },
            })
        }

        await recordOperationLog({
            userId: authResult.payload.sub,
            action: OperationAction.CREATE,
            entityType: OperationEntityType.ESTIMATE,
            entityId: estimate.id,
            docNo: estimate.docNo,
        })

        return NextResponse.json(
            serializeBigInt({
                ...estimate,
                id: estimate.id.toString(),
                customerId: estimate.customerId.toString(),
            }),
            { status: 201 }
        )
    } catch (error: any) {
        console.error('Create estimate error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
