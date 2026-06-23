import apiClient from './api'

export interface ProductVariant {
    id: string
    productItemId: string
    storeId?: string | null
    store?: { id: string; name: string } | null
    name: string
    imageUrl?: string | null
    priceGeneral: number
    priceMember: number
    setPrice?: number
    isDefaultSet?: boolean
    isActive: boolean
    sortNo?: number
}

/**
 * 互助会員/一般顧客のどちらでも適用するかの範囲。
 * - NONE: 適用しない（チェックボックス・「セット」表示も出ない）
 * - MEMBER_ONLY: 互助会員のときのみ適用
 * - GENERAL_ONLY: 一般顧客のときのみ適用（レアケース）
 * - BOTH: 一般・会員両方で適用
 */
export type AppliesTo = 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'

/**
 * 明細行の計算方式
 * - FIXED: 数量を無視し、unitPrice を 1 回だけ計上
 * - UNIT_PRICE_X_QTY: 単価 × 数量
 */
export type RowCalcType = 'FIXED' | 'UNIT_PRICE_X_QTY'

/** 明細行内の種類選択肢 */
export interface ProductRowVariant {
    id: string
    productRowId?: string
    label: string
    imageUrl?: string | null
    unitPrice: number
    isDefault?: boolean
    sortNo?: number
    isActive?: boolean
}

/** 1商品を構成する明細行（複数行構成商品で利用） */
export interface ProductRow {
    id: string
    productItemId?: string
    label: string
    calcType: RowCalcType
    defaultQty: number
    /** true の場合、明細展開時に加算行と返品（減算）行の2行を生成 */
    hasReturn: boolean
    sortNo?: number
    isActive?: boolean
    variants: ProductRowVariant[]
}

export interface ProductItem {
    id: string
    name: string
    defaultDescription?: string | null
    sortNo?: number
    isSetParent?: boolean
    isSetChild?: boolean
    serviceableScope?: AppliesTo
    setableScope?: AppliesTo
    isMaturityServiceable?: boolean
    isMultiRow?: boolean
    canAddFreeRow?: boolean
    isActive: boolean
    variants: ProductVariant[]
    rows?: ProductRow[]
    children?: { id: string; name: string; sortNo?: number }[]
}

export interface ProductItemInput {
    name: string
    defaultDescription?: string | null
    isActive?: boolean
    sortNo?: number
    isSetParent?: boolean
    isSetChild?: boolean
    serviceableScope?: AppliesTo
    setableScope?: AppliesTo
    isMultiRow?: boolean
    isMaturityServiceable?: boolean
    canAddFreeRow?: boolean
}

export interface ProductSetInput {
    childIds: string[]
}

export async function setProductChildren(parentId: string, childIds: string[]): Promise<void> {
    await apiClient.put(`/products/${parentId}/children`, { childIds })
}

export interface ProductVariantInput {
    name: string
    storeId?: string | null
    imageUrl?: string | null
    priceGeneral: number
    priceMember: number
    setPrice?: number
    isDefaultSet?: boolean
    isActive?: boolean
    sortNo?: number
}

export async function getProducts(name?: string): Promise<ProductItem[]> {
    const url = name ? `/products?name=${encodeURIComponent(name)}` : '/products'
    const response = await apiClient.get<ProductItem[]>(url)
    return response.data
}

export async function getAllProducts(): Promise<ProductItem[]> {
    const response = await apiClient.get<ProductItem[]>('/products?includeInactive=true')
    return response.data
}

export async function getProduct(id: string): Promise<ProductItem> {
    const response = await apiClient.get<ProductItem>(`/products/${id}`)
    return response.data
}

export async function getProductVariants(productItemId: string): Promise<ProductVariant[]> {
    const response = await apiClient.get<ProductVariant[]>(`/products/${productItemId}/variants`)
    return response.data
}

export async function createProduct(data: ProductItemInput): Promise<ProductItem> {
    const response = await apiClient.post<ProductItem>('/products', data)
    return response.data
}

export async function updateProduct(id: string, data: ProductItemInput): Promise<ProductItem> {
    const response = await apiClient.put<ProductItem>(`/products/${id}`, data)
    return response.data
}

export async function deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`)
}

export async function reorderProducts(ids: string[]): Promise<void> {
    await apiClient.put('/products/reorder', { ids })
}

export async function createVariant(productItemId: string, data: ProductVariantInput): Promise<ProductVariant> {
    const response = await apiClient.post<ProductVariant>(`/products/${productItemId}/variants`, data)
    return response.data
}

export async function updateVariant(
    productItemId: string,
    variantId: string,
    data: ProductVariantInput
): Promise<ProductVariant> {
    const response = await apiClient.put<ProductVariant>(`/products/${productItemId}/variants/${variantId}`, data)
    return response.data
}

export type DeleteVariantResult = { deleted: 'logical' | 'physical' }

export async function deleteVariant(
    productItemId: string,
    variantId: string
): Promise<DeleteVariantResult> {
    const response = await apiClient.delete<DeleteVariantResult>(
        `/products/${productItemId}/variants/${variantId}`
    )
    return response.data
}

export async function uploadProductImage(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const response = await apiClient.post<{ url: string }>('/upload/product-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.url
}

export interface ProductImageUsage {
    productId: string
    productName: string
    variantId: string
    variantName: string
}

export interface ProductImageFile {
    url: string
    fileName: string
    relativePath?: string
    size: number
    modifiedAt: string
    usedBy: ProductImageUsage[]
}

export async function listProductImages(): Promise<ProductImageFile[]> {
    const response = await apiClient.get<{ files: ProductImageFile[] }>('/upload/product-image/list')
    return response.data.files
}
