import apiClient from './api'

export interface Store {
    id: string
    name: string
    sortNo: number
    isActive: boolean
}

export interface StoreInput {
    name: string
    sortNo?: number
    isActive?: boolean
}

export async function getStores(): Promise<Store[]> {
    const response = await apiClient.get<Store[]>('/stores')
    return response.data
}

export async function getAllStores(): Promise<Store[]> {
    const response = await apiClient.get<Store[]>('/stores?includeInactive=true')
    return response.data
}

export async function createStore(data: StoreInput): Promise<Store> {
    const response = await apiClient.post<Store>('/stores', data)
    return response.data
}

export async function updateStore(id: string, data: StoreInput): Promise<Store> {
    const response = await apiClient.put<Store>(`/stores/${id}`, data)
    return response.data
}

export async function deleteStore(id: string): Promise<void> {
    await apiClient.delete(`/stores/${id}`)
}
