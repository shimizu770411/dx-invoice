import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAuth } from '@/lib/auth-middleware'
import { getOperationLogReport, parseReportDateRange, OperationLogReportRow } from '@/lib/operationLogReport'

const ENTITY_TYPE_LABELS: Record<string, string> = {
    ESTIMATE: '見積',
    INVOICE: '請求書',
    RECEIPT: '領収書',
    FLOWER: '生花',
}

const ACTION_LABELS: Record<string, string> = {
    CREATE: '新規',
    UPDATE: '更新',
    ISSUE_PDF: '発行',
    REISSUE_PDF: '再発行',
}

/** 業務上実際に発生し得る (書類種別, 操作) の組み合わせ */
const REPORT_COLUMNS: { entityType: string; action: string }[] = [
    { entityType: 'ESTIMATE', action: 'CREATE' },
    { entityType: 'ESTIMATE', action: 'UPDATE' },
    { entityType: 'INVOICE', action: 'CREATE' },
    { entityType: 'INVOICE', action: 'UPDATE' },
    { entityType: 'RECEIPT', action: 'ISSUE_PDF' },
    { entityType: 'RECEIPT', action: 'REISSUE_PDF' },
    { entityType: 'FLOWER', action: 'CREATE' },
    { entityType: 'FLOWER', action: 'UPDATE' },
]

const UNKNOWN_USER_LABEL = '(不明)'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { searchParams } = new URL(request.url)
        const range = parseReportDateRange(searchParams)
        if (!range) {
            return NextResponse.json({ error: 'from, to は YYYY-MM-DD 形式で指定してください' }, { status: 400 })
        }

        const rows = await getOperationLogReport(range.from, range.to)

        const workbook = new ExcelJS.Workbook()
        buildDetailSheet(workbook, rows)
        buildUserSummarySheet(workbook, rows)

        const buffer = await workbook.xlsx.writeBuffer()

        const fromLabel = searchParams.get('from')
        const toLabel = searchParams.get('to')
        const filename = `操作ログレポート_${fromLabel}_${toLabel}.xlsx`

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            },
        })
    } catch (error: any) {
        console.error('Get operation log report excel error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

function buildDetailSheet(workbook: ExcelJS.Workbook, rows: OperationLogReportRow[]) {
    const sheet = workbook.addWorksheet('明細')
    sheet.columns = [
        { header: '日付', key: 'reportDate', width: 14 },
        { header: '担当者', key: 'userName', width: 16 },
        { header: '書類種別', key: 'entityType', width: 12 },
        { header: '操作', key: 'action', width: 12 },
        { header: '件数', key: 'count', width: 10 },
    ]
    sheet.getRow(1).font = { bold: true }

    for (const row of rows) {
        sheet.addRow({
            reportDate: row.reportDate,
            userName: row.userName ?? UNKNOWN_USER_LABEL,
            entityType: ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType,
            action: ACTION_LABELS[row.action] ?? row.action,
            count: row.count,
        })
    }
}

function buildUserSummarySheet(workbook: ExcelJS.Workbook, rows: OperationLogReportRow[]) {
    const sheet = workbook.addWorksheet('担当者別集計')

    sheet.columns = [
        { header: '担当者', key: 'userName', width: 16 },
        ...REPORT_COLUMNS.map((c) => ({
            header: `${ENTITY_TYPE_LABELS[c.entityType]}${ACTION_LABELS[c.action]}`,
            key: columnKey(c.entityType, c.action),
            width: 14,
        })),
    ]
    sheet.getRow(1).font = { bold: true }

    const userNames = Array.from(new Set(rows.map((r) => r.userName ?? UNKNOWN_USER_LABEL))).sort()

    for (const userName of userNames) {
        const record: Record<string, string | number> = { userName }
        for (const c of REPORT_COLUMNS) {
            record[columnKey(c.entityType, c.action)] = rows
                .filter(
                    (r) =>
                        (r.userName ?? UNKNOWN_USER_LABEL) === userName &&
                        r.entityType === c.entityType &&
                        r.action === c.action
                )
                .reduce((sum, r) => sum + r.count, 0)
        }
        sheet.addRow(record)
    }
}

function columnKey(entityType: string, action: string): string {
    return `${entityType}_${action}`
}
