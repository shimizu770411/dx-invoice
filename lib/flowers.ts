import apiClient from './api'

export interface FamilyNameSource {
    estimateDisplayName: string | null
    deceasedLastName: string | null
    deceasedName: string
}

/** 喪家名を取得する。案件に喪家名が入力されていない場合は故人の姓、それも未入力なら死亡者名をそのまま返す */
export function getFamilyName(customer: FamilyNameSource): string {
    if (customer.estimateDisplayName) return customer.estimateDisplayName
    if (customer.deceasedLastName) return customer.deceasedLastName
    return customer.deceasedName
}

export interface Flower {
    id: string
    customerId: string
    requesterName: string
    labelName?: string
    jointNames?: string
    billToName: string
    billToAddress: string
    billToTel?: string
    deliveryTo?: string
    amount: number
    flowerBillingTargetId?: string | null
}

export interface FlowerBillingTarget {
    id: string
    customerId: string
    billToName: string
    billToAddress: string
    billToTel?: string
    billToKey?: string
    isPaid?: boolean
    paidAt?: string | null
    flowers: Flower[]
}

// 請求先一覧（供花込み）
export async function getBillingTargets(customerId: string): Promise<FlowerBillingTarget[]> {
    const response = await apiClient.get<FlowerBillingTarget[]>(`/flowers/customers/${customerId}/billing-targets`)
    return response.data
}

// 請求先の新規登録
export async function createBillingTarget(
    customerId: string,
    data: { billToName: string; billToAddress: string; billToTel?: string }
): Promise<FlowerBillingTarget> {
    const response = await apiClient.post(`/flowers/customers/${customerId}/billing-targets`, data)
    return response.data
}

// 請求先の更新
export async function updateBillingTarget(
    id: string,
    data: { billToName: string; billToAddress: string; billToTel?: string }
): Promise<FlowerBillingTarget> {
    const response = await apiClient.put(`/flowers/billing-targets/${id}`, data)
    return response.data
}

// 請求先の削除
export async function deleteBillingTarget(id: string): Promise<void> {
    await apiClient.delete(`/flowers/billing-targets/${id}`)
}

/** @deprecated getBillingTargets を使用してください */
export async function getFlowers(customerId: string): Promise<FlowerBillingTarget[]> {
    return getBillingTargets(customerId)
}

export async function getFlower(id: string): Promise<Flower> {
    const response = await apiClient.get<Flower>(`/flowers/${id}`)
    return response.data
}

export async function createFlower(customerId: string, data: any): Promise<Flower> {
    const response = await apiClient.post(`/flowers/customers/${customerId}/flowers`, data)
    return response.data
}

export async function updateFlower(id: string, data: any): Promise<Flower> {
    const response = await apiClient.put(`/flowers/${id}`, data)
    return response.data
}

export async function deleteFlower(id: string): Promise<void> {
    await apiClient.delete(`/flowers/${id}`)
}
