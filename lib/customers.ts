import apiClient from './api'

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

// 会員証欄のみを更新する（PUT /customers/:id は全項目洗い替えのため専用エンドポイントを使う）
export async function updateMemberCardNote(id: string, memberCardNote: string) {
    const response = await apiClient.patch(`/customers/${id}/member-card-note`, { memberCardNote })
    return response.data
}
