import { useQuery } from '@tanstack/react-query'
import { getOperationLogReport } from '@/lib/operationLogs'

export function useOperationLogReportQuery(from: string, to: string, enabled: boolean) {
    return useQuery({
        queryKey: ['operationLogReport', from, to],
        queryFn: () => getOperationLogReport(from, to),
        enabled,
    })
}
