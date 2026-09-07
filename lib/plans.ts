import apiClient from './api'
import { ProductItem, AppliesTo } from './products'

// 基本プラン。Estimate/Invoice の plan_id デフォルト値が参照するため削除不可（API側でも拒否される）
export const BASE_PLAN_ID = '1'

export interface Plan {
    id: string
    name: string
    sortNo: number
    isActive: boolean
}

export interface PlanInput {
    name: string
    sortNo?: number
    isActive?: boolean
}

export async function getPlans(): Promise<Plan[]> {
    const response = await apiClient.get<Plan[]>('/plans')
    return response.data
}

export async function getAllPlans(): Promise<Plan[]> {
    const response = await apiClient.get<Plan[]>('/plans?includeInactive=true')
    return response.data
}

export async function createPlan(data: PlanInput): Promise<Plan> {
    const response = await apiClient.post<Plan>('/plans', data)
    return response.data
}

export async function updatePlan(id: string, data: PlanInput): Promise<Plan> {
    const response = await apiClient.put<Plan>(`/plans/${id}`, data)
    return response.data
}

export async function deletePlan(id: string): Promise<void> {
    await apiClient.delete(`/plans/${id}`)
}

/** プラン別商品設定画面で選択肢として使うバリアントの最小情報 */
export interface ProductPlanSettingVariant {
    id: string
    name: string
    isDefaultSet: boolean
}

/**
 * 商品×プランの上書き設定。
 * - setableScope: 「セット可否（初期セット品の0円扱いの適用範囲）」の上書き。null=商品マスタ本来の値を継承。
 *   セット親商品には意味を持たない（画面上は非活性にする）。
 * - overrideDefaultVariantId: 一般商品専用。このプランで「初期セット品」として扱うバリアントの指定。
 *   null=商品マスタ本来のisDefaultSet設定のまま。セット子商品は商品マスタ側で設定済みのため対象外。
 */
export interface ProductPlanSettingItem {
    productItemId: string
    productName: string
    sortNo: number
    isSetParent: boolean
    isSetChild: boolean
    defaultSetableScope: AppliesTo
    isVisible: boolean
    setableScope: AppliesTo | null
    overrideDefaultVariantId: string | null
    variants: ProductPlanSettingVariant[]
}

export async function getProductPlanSettings(planId: string): Promise<ProductPlanSettingItem[]> {
    const response = await apiClient.get<ProductPlanSettingItem[]>(`/plans/${planId}/product-settings`)
    return response.data
}

export interface ProductPlanSettingInput {
    productItemId: string
    isVisible: boolean
    setableScope: AppliesTo | null
    overrideDefaultVariantId: string | null
}

export async function saveProductPlanSettings(
    planId: string,
    settings: ProductPlanSettingInput[]
): Promise<void> {
    await apiClient.put(`/plans/${planId}/product-settings`, { settings })
}

/**
 * 商品一覧にプランの上書き設定を適用する。
 * - isVisible=false の商品は一覧から除外
 * - setableScope は上書き値（null以外）があればそれを、無ければ商品マスタ本来の値を使う
 * - overrideDefaultVariantId が指定されている場合、その商品を実質セット子扱いにし、
 *   指定バリアントだけ isDefaultSet=true、他は false に上書きする
 * 見積側のセット0円判定・合計計算は productItem.isSetChild / setableScope / variant.isDefaultSet を
 * 参照する実装のため、ここで値を書き換えておけば既存ロジックを変更せずにプラン別の挙動を反映できる。
 */
export function applyPlanOverrides(
    products: ProductItem[],
    settings: ProductPlanSettingItem[]
): ProductItem[] {
    const settingMap = new Map(settings.map((s) => [s.productItemId, s]))
    const result: ProductItem[] = []
    for (const product of products) {
        const s = settingMap.get(product.id)
        if (!s) {
            result.push(product)
            continue
        }
        if (!s.isVisible) continue

        const effectiveSetableScope = s.setableScope !== null ? s.setableScope : product.setableScope

        let isSetChild = product.isSetChild
        let isPlanForcedSet = false
        let variants = product.variants
        if (s.overrideDefaultVariantId) {
            // デフォルトで選択される種類の上書きは、セット可否に関わらず常に適用する
            variants = variants.map((v) => ({
                ...v,
                isDefaultSet: v.id === s.overrideDefaultVariantId,
            }))
            // 一方、初期セット品扱い（自動チェック）は、セット可否が「不可」の場合は行わない
            if (effectiveSetableScope !== 'NONE') {
                isSetChild = true
                isPlanForcedSet = true
            }
        }

        result.push({
            ...product,
            isSetChild,
            isPlanForcedSet,
            variants,
            setableScope: effectiveSetableScope,
        })
    }

    // このプランで表示されるセット親商品が1件だけの場合、その商品と、それに紐づく子商品を
    // 「自動チェック対象」としてマークする（見積側で、プラン選択時に自動チェックするために使う）
    const setParents = result.filter((p) => p.isSetParent)
    if (setParents.length === 1) {
        const soleParent = setParents[0]
        const childIds = new Set((soleParent.children || []).map((c) => String(c.id)))
        return result.map((p) => {
            if (p.id === soleParent.id) return { ...p, isSoleSetParent: true }
            if (p.isSetChild && !p.isPlanForcedSet && childIds.has(String(p.id))) {
                return { ...p, isSoleSetParentChild: true }
            }
            return p
        })
    }
    return result
}
