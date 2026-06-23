import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

function calculateTotals(items: any[], membershipPaidAmount: number, freeItems: any[] = []) {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const freeSubtotal = freeItems.reduce((sum, item) => sum + (item.unitPriceGeneral || 0) * (item.qty || 1), 0)
    const subtotal = itemsSubtotal + freeSubtotal
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax
    const grandTotal = total - membershipPaidAmount

    return {
        subtotal,
        tax,
        total,
        membershipPaidAmount,
        grandTotal: Math.max(0, grandTotal),
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ customerId: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { customerId } = params
        const data = await request.json()

        // 顧客を取得
        const customer = await prisma.customer.findUnique({
            where: { id: BigInt(customerId) },
            include: {
                memberships: true,
            },
        })

        if (!customer) {
            return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
        }

        const membershipPaidAmount = customer.memberships.reduce(
            (sum: number, m: any) => sum + (m.paymentAmount || 0),
            0
        )

        const totals = calculateTotals(data.items || [], membershipPaidAmount, data.freeItems || [])

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

        // docNo の自動採番: customers.reception_atの年月(yyyymm) + 同プレフィックスの最大連番+1(3桁)
        const receptionDate = customer.receptionAt ? new Date(customer.receptionAt) : new Date()
        const yyyy = receptionDate.getFullYear()
        const mm = String(receptionDate.getMonth() + 1).padStart(2, '0')
        const prefix = `${yyyy}${mm}`
        const latestDoc = await prisma.invoice.findFirst({
            where: { docNo: { startsWith: prefix } },
            orderBy: { docNo: 'desc' },
        })
        const nextSeq = latestDoc?.docNo ? parseInt(latestDoc.docNo.slice(6)) + 1 : 1
        const docNo = data.docNo || `${prefix}${String(nextSeq).padStart(3, '0')}`

        const invoice = await prisma.invoice.create({
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
                fromEstimateId: data.fromEstimateId ? BigInt(data.fromEstimateId) : null,
                cremationProcessType,
                altarPlaceType,
                altarPlaceOther: data.altarPlaceOther || null,
                ceilingHeight: data.ceilingHeight || null,
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
                        sortNo: item.sortNo ?? index,
                    })),
                },
            },
            include: {
                customer: true,
                items: true,
            },
        })

        // フリー項目を保存
        const freeItems: any[] = data.freeItems || []
        if (freeItems.length > 0) {
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
        console.error('Create invoice error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
