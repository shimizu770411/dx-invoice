import apiClient from './api'
import type { CaseProgress } from './caseProgress'

export interface CustomerListItem {
    id: string
    receptionNo: string
    deceasedName: string
    chiefMournerName: string
    age: number | null
    address: string
    receptionAt: string | null
    funeralFrom: string | null
    hasEstimate: boolean
    estimateId?: string
    estimateStatus?: string | null
    estimateType?: 'PRE_CONSULTATION' | 'FORMAL'
    preConsultEstimateId?: string
    hasInvoice: boolean
    invoiceId?: string
    isPaid: boolean
    chiefMournerCity: { id: string; name: string } | null
    chiefMournerTown: { id: string; name: string } | null
}

export interface SearchCustomersParams {
    cityId?: string
    townId?: string
    deceasedName?: string
    receptionFrom?: string
    receptionTo?: string
    funeralFrom?: string
    funeralTo?: string
    paid?: boolean
    unpaid?: boolean
    estimateStatusConfirmed?: boolean
    salesStaffName?: string
    funeralPlace?: string
    estimateStatus?: string
    noEstimate?: boolean
}

export async function searchCustomers(params: SearchCustomersParams): Promise<CustomerListItem[]> {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value))
        }
    })

    const response = await apiClient.get<CustomerListItem[]>(`/customers?${queryParams.toString()}`)
    return response.data
}

export async function getCustomer(id: string) {
    const response = await apiClient.get(`/customers/${id}`)
    if (!response.data) throw new Error('案件が見つかりません')
    return response.data
}

export async function createCustomer(data: any) {
    const response = await apiClient.post('/customers', data)
    return response.data
}

export async function updateCustomer(id: string, data: any) {
    const response = await apiClient.put(`/customers/${id}`, data)
    return response.data
}

/**
 * 案件の進捗（見積・請求・入金の有無）だけを取得する。
 * 各画面の上部に置く切替バーが、次にどの書類へ行けるかを判断するために使う。
 */
export async function getCaseProgress(customerId: string): Promise<CaseProgress> {
    const response = await apiClient.get<CaseProgress>(`/customers/${customerId}/progress`)
    return response.data
}
