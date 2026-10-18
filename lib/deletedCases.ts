import apiClient from './api'
import type { CaseDeletionSummary } from './caseDeletionMessage'

export interface DeletedCaseRow {
    id: string
    originalCustomerId: string
    receptionNo: string | null
    deceasedName: string
    chiefMournerName: string | null
    summary: CaseDeletionSummary
    deletedAt: string
    deletedByName: string | null
}

export interface DeletedCaseFilter {
    from: string
    to: string
    keyword: string
}

export async function getDeletedCases(filter: DeletedCaseFilter): Promise<DeletedCaseRow[]> {
    const params: Record<string, string> = { from: filter.from, to: filter.to }
    if (filter.keyword.trim()) params.keyword = filter.keyword.trim()
    const response = await apiClient.get<DeletedCaseRow[]>('/reports/deleted-cases', { params })
    return response.data ?? []
}
