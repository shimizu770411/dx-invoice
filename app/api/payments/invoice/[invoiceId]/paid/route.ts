import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePaymentRole } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { isValidReceiptNo, normalizeReceiptNo, RECEIPT_NO_INVALID_MESSAGE } from '@/lib/receiptNo'

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

        // 領収書No.（任意・数字7桁）。画面でも確かめているが、画面を通さない呼び出しでも不正な値を保存しない
        if (!isValidReceiptNo(data.receiptNo)) {
            // 画面は 400 の error をそのまま通知に出す（lib/errorHandler.ts の extractValidationErrorMessage）
            return NextResponse.json({ error: RECEIPT_NO_INVALID_MESSAGE }, { status: 400 })
        }

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
                receiptNo: normalizeReceiptNo(data.receiptNo),
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
