import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireReceiptApprovalRole } from '@/lib/auth-middleware'

/**
 * 領収書の承認・承認取消。
 *
 * 承認は今の入金（最新の入金済みの記録）に、承認した人と日時を書き込む。領収書の取扱者印にその人の印影が出る。
 * 入金を取り消すと新しい記録（取消）が最新になるため、承認も一緒に外れる。
 * 承認しなくても領収書は発行できる（取扱者印が空欄になるだけ。2026-11-12 ユーザー指示）。
 *
 * body: { approve: boolean }  true で承認、false で承認取消
 */
export async function POST(request: NextRequest, props: { params: Promise<{ invoiceId: string }> }) {
    const params = await props.params
    try {
        // JWT認証と、領収書を承認できるロール（事務員・決裁者）かの確認
        const authResult = await requireReceiptApprovalRole(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { invoiceId } = params
        const data = await request.json()
        const approve = data?.approve === true
        const userId = authResult.payload.sub

        const latestPayment = await prisma.payment.findFirst({
            where: { invoiceId: BigInt(invoiceId), targetType: 'INVOICE' as const },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        if (!latestPayment || latestPayment.status !== 'PAID') {
            return NextResponse.json({ error: '入金登録されていないため、領収書を承認できません' }, { status: 400 })
        }

        const updated = await prisma.payment.update({
            where: { id: latestPayment.id },
            data: approve
                ? { receiptApprovedById: BigInt(userId), receiptApprovedAt: new Date() }
                : { receiptApprovedById: null, receiptApprovedAt: null },
            include: { receiptApprovedBy: { select: { id: true, name: true } } },
        })

        return NextResponse.json({
            isReceiptApproved: updated.receiptApprovedById != null,
            receiptApprovedAt: updated.receiptApprovedAt,
            receiptApprovedBy: updated.receiptApprovedBy
                ? { id: updated.receiptApprovedBy.id.toString(), name: updated.receiptApprovedBy.name }
                : null,
        })
    } catch (error: any) {
        console.error('Receipt approval error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
