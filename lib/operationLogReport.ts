import { prisma } from '@/lib/prisma'

/**
 * クエリパラメータの from/to (YYYY-MM-DD) を期間 [from, to) に変換する。
 * to は指定日を含めるため、内部的には翌日0時を排他的境界として返す。
 */
export function parseReportDateRange(searchParams: URLSearchParams): { from: Date; to: Date } | null {
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    if (!fromStr || !toStr) return null

    const from = new Date(`${fromStr}T00:00:00`)
    const to = new Date(`${toStr}T00:00:00`)
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return null

    to.setDate(to.getDate() + 1)
    return { from, to }
}

export interface OperationLogReportRow {
    reportDate: string
    userId: string | null
    userName: string | null
    entityType: string
    action: string
    count: number
}

/**
 * 日別・ユーザー別・書類種別・アクション別に operation_logs を集計する。
 * `to` は排他的境界（呼び出し側で期間末日の翌日0時を渡すこと）。
 */
export async function getOperationLogReport(from: Date, to: Date): Promise<OperationLogReportRow[]> {
    const rows = await prisma.$queryRaw<
        Array<{
            report_date: Date
            user_id: bigint | null
            entity_type: string
            action: string
            count: bigint
        }>
    >`
        SELECT
            DATE(occurred_at) AS report_date,
            user_id,
            entity_type,
            action,
            COUNT(*) AS count
        FROM operation_logs
        WHERE occurred_at >= ${from} AND occurred_at < ${to}
        GROUP BY report_date, user_id, entity_type, action
        ORDER BY report_date ASC, user_id ASC
    `

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((id): id is bigint => id !== null)))
    const users =
        userIds.length > 0
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
            : []
    const userNameById = new Map(users.map((u) => [u.id.toString(), u.name]))

    return rows.map((r) => ({
        reportDate: r.report_date.toISOString().split('T')[0],
        userId: r.user_id?.toString() ?? null,
        userName: r.user_id ? userNameById.get(r.user_id.toString()) ?? null : null,
        entityType: r.entity_type,
        action: r.action,
        count: Number(r.count),
    }))
}
