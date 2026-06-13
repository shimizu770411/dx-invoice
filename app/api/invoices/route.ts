import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

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

        // 検索条件を構築
        const where: any = {}
        if (customerId) {
            where.customerId = BigInt(customerId)
        }

        // 請求書を取得
        const invoices = await prisma.invoice.findMany({
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

        // レスポンス形式に変換
        const result = invoices.map((invoice: any) => ({
            ...invoice,
            id: invoice.id.toString(),
            customerId: invoice.customerId.toString(),
            fromEstimateId: invoice.fromEstimateId?.toString(),
            customer: {
                ...invoice.customer,
                id: invoice.customer.id.toString(),
            },
            items: invoice.items.map((item: any) => ({
                ...item,
                id: item.id.toString(),
                invoiceId: item.invoiceId.toString(),
                productItemId: item.productItemId?.toString(),
                productVariantId: item.productVariantId?.toString(),
            })),
        }))

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get invoices error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
