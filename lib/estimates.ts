import apiClient from './api'

export interface EstimateFreeItem {
    id?: string
    estimateItemId?: string
    parentProductItemId?: string | null
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
    adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
    multiSelectVariantIds?: string | null
    /** 保存後の行がどのバリアントグループ（重箱の基本セット／追加オプション等）由来かを示す */
    productVariantGroupId?: string | null
    /** グループ商品の選択状態（保存前の一時データ）。JSON文字列: { [groupId]: variantId[] } */
    groupSelections?: string | null
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
    estimateType: 'PRE_CONSULTATION' | 'FORMAL'
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
    if (!response.data) throw new Error('見積データが見つかりません')
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

export async function confirmEstimate(id: string): Promise<{ id: string }> {
    const response = await apiClient.post<{ id: string }>(`/estimates/${id}/confirm`)
    return response.data
}
