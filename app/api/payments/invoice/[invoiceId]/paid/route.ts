import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePaymentRole } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function POST(request: NextRequest, props: { params: Promise<{ invoiceId: string }> }) {
    const params = await props.params
    try {
        // JWT認証と、入金を扱えるロール（事務員・経理・決裁者）かの確認
        const authResult = await requirePaymentRole(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { invoiceId } = params
        const data = await request.json()
        const userId = authResult.payload.sub

        // 請求書を取得
        const invoice = await prisma.invoice.findUnique({
            where: { id: BigInt(invoiceId) },
            include: { customer: true },
        })

        if (!invoice) {
            return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
        }

        // 入金を作成
        const payment = await prisma.payment.create({
            data: {
                customerId: invoice.customerId,
                targetType: 'INVOICE' as const,
                status: 'PAID' as const,
                invoiceId: BigInt(invoiceId),
                paidAt: new Date(data.paidAt),
                amount: invoice.grandTotal,
                memo: data.memo,
                createdById: userId ? BigInt(userId) : null,
            },
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...payment,
                id: payment.id.toString(),
                customerId: payment.customerId.toString(),
                invoiceId: payment.invoiceId?.toString(),
                createdById: payment.createdById?.toString(),
            })
        )
    } catch (error: any) {
        console.error('Create invoice payment error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
