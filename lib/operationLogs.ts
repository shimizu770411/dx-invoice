import apiClient from './api'

export type OperationLogEntityType = 'ESTIMATE' | 'INVOICE' | 'RECEIPT'
export type OperationLogAction = 'CREATE' | 'UPDATE' | 'ISSUE_PDF' | 'REISSUE_PDF'

export const OPERATION_LOG_ENTITY_TYPE_LABELS: Record<OperationLogEntityType, string> = {
    ESTIMATE: '見積',
    INVOICE: '請求書',
    RECEIPT: '領収書',
}

export const OPERATION_LOG_ACTION_LABELS: Record<OperationLogAction, string> = {
    CREATE: '新規',
    UPDATE: '更新',
    ISSUE_PDF: '発行',
    REISSUE_PDF: '再発行',
}

export interface OperationLogReportRow {
    reportDate: string
    userId: string | null
    userName: string | null
    entityType: OperationLogEntityType
    action: OperationLogAction
    count: number
}

export async function getOperationLogReport(from: string, to: string): Promise<OperationLogReportRow[]> {
    const response = await apiClient.get<OperationLogReportRow[]>('/reports/operations', {
        params: { from, to },
    })
    return response.data
}

export function getOperationLogReportExcelUrl(from: string, to: string): string {
    return `/api/reports/operations/excel?from=${from}&to=${to}`
}
