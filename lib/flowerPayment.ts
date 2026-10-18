import { Prisma } from '@phoenix-jpn/db'

/**
 * 供花1件ごとの入金状況（サーバー側）。
 * 入金は追記式の記録（入金済み PAID / 取消 CANCELLED）で、その供花の最新の記録が PAID なら入金済み。
 * 旧方式の請求先単位の記録（FLOWER_TARGET）は 2026-10 に供花単位へ移行済みのため見ない。
 */

// 供花を読み込むときに include へ足すと、最新の入金記録が1件付く
export const LATEST_FLOWER_PAYMENT_INCLUDE = {
    payments: {
        where: { targetType: 'FLOWER' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
    },
} satisfies Prisma.FlowerInclude

type LatestPayment = { status: string; paidAt: Date }

export function toFlowerPaymentState(payments: LatestPayment[] | undefined): { isPaid: boolean; paidAt: Date | null } {
    const latest = payments?.[0]
    const isPaid = latest?.status === 'PAID'
    return { isPaid, paidAt: isPaid ? latest!.paidAt : null }
}

/** 供花が入金済みか（編集・削除・入金の可否の判定用） */
export async function isFlowerPaid(db: Prisma.TransactionClient, flowerId: bigint): Promise<boolean> {
    const latest = await db.payment.findFirst({
        where: { targetType: 'FLOWER', flowerId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { status: true },
    })
    return latest?.status === 'PAID'
}
