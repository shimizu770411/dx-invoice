import { Prisma } from '@phoenix-jpn/db'
import { buildDocNoPrefix, buildNextDocNo } from '@/lib/documentUtils'

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002'

/**
 * 本見積の見積番号を採番する（葬儀・告別式の開始日時の年月 + その年月の最大値+1）。
 * 事前見積に残っている旧番号も最大値に含める。見積番号は見積全体で重複不可のため、
 * 本見積だけで数えると旧番号と衝突する。
 */
export async function findNextEstimateDocNo(tx: Prisma.TransactionClient, funeralFrom: Date): Promise<string> {
    const existing = await tx.estimate.findMany({
        where: { docNo: { startsWith: buildDocNoPrefix(funeralFrom) } },
        select: { docNo: true },
    })
    return buildNextDocNo(funeralFrom, existing.map((e) => e.docNo))
}

/** 同時に採番されて番号が重複した（DBの一意制約に引っかかった）か */
export function isDocNoConflictError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
    if (error.code !== UNIQUE_CONSTRAINT_ERROR_CODE) return false
    // 他の一意制約の違反と取り違えないよう、見積番号の列かどうかまで確かめる
    const target = error.meta?.target
    const targets = Array.isArray(target) ? target : [target]
    return targets.some((t) => typeof t === 'string' && (t.includes('doc_no') || t.includes('docNo')))
}
