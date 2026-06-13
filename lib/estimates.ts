import apiClient from './api'

export interface EstimateFreeItem {
    id?: string
    estimateItemId?: string
    productItemName: string
    description?: string
    unitPriceGeneral: number
    qty: number
    amount: number
    sortNo: number
}

export interface EstimateItem {
    id?: string
    productItemId?: string
    productVariantId?: string
    productRowId?: string | null
    productRowVariantId?: string | null
    calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null
    sign?: number
    description?: string
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    amount: number
    isService?: boolean
    isMaturityService?: boolean
    sortNo: number
    productItem?: any
    productVariant?: any
    productRow?: any
    productRowVariant?: any
}

export interface Estimate {
    id: string
    customerId: string
    docNo?: string
    status: string
    subtotal: number
    tax: number
    total: number
    membershipPaidAmount: number
    grandTotal: number
    items: EstimateItem[]
    customer?: any
}

export async function getEstimates(customerId?: string): Promise<Estimate[]> {
    const url = customerId ? `/estimates?customerId=${customerId}` : '/estimates'
    const response = await apiClient.get<Estimate[]>(url)
    return response.data
}

export async function getEstimate(id: string): Promise<Estimate> {
    const response = await apiClient.get<Estimate>(`/estimates/${id}`)
    return response.data
}

export async function createEstimate(customerId: string, data: any): Promise<Estimate> {
    const response = await apiClient.post('/estimates', { ...data, customerId })
    return response.data
}

export async function updateEstimate(id: string, data: any): Promise<Estimate> {
    const response = await apiClient.put(`/estimates/${id}`, data)
    return response.data
}

export async function unconfirmEstimate(id: string): Promise<Estimate> {
    const response = await apiClient.post(`/estimates/${id}/unconfirm`)
    return response.data
}
