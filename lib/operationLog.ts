import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'
import { prisma } from '@/lib/prisma'

/**
 * 見積・請求書・領収書の作成/更新/PDF発行を記録する。
 * レポート集計（日別・ユーザー別の枚数）専用のログのため、
 * 記録に失敗しても本処理（見積・請求書の保存等）は失敗させない。
 */
export async function recordOperationLog(params: {
    userId: string | null
    action: OperationAction
    entityType: OperationEntityType
    entityId: bigint
    docNo?: string | null
}) {
    try {
        await prisma.operationLog.create({
            data: {
                userId: params.userId ? BigInt(params.userId) : null,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                docNo: params.docNo ?? null,
            },
        })
    } catch (error) {
        console.error('Operation log record error:', error)
    }
}

/**
 * 領収書PDFの発行を記録する。同一請求書への初回発行はISSUE_PDF、
 * 2回目以降はREISSUE_PDFとして区別する。
 */
export async function recordReceiptIssue(params: {
    userId: string | null
    invoiceId: bigint
    docNo?: string | null
}) {
    try {
        const existing = await prisma.operationLog.findFirst({
            where: {
                entityType: OperationEntityType.RECEIPT,
                entityId: params.invoiceId,
                action: { in: [OperationAction.ISSUE_PDF, OperationAction.REISSUE_PDF] },
            },
            select: { id: true },
        })

        await recordOperationLog({
            userId: params.userId,
            action: existing ? OperationAction.REISSUE_PDF : OperationAction.ISSUE_PDF,
            entityType: OperationEntityType.RECEIPT,
            entityId: params.invoiceId,
            docNo: params.docNo,
        })
    } catch (error) {
        console.error('Receipt issue log record error:', error)
    }
}
