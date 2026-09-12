import apiClient from './api'

/**
 * 親祭壇の増額。
 *
 * この増額は帳票に行として出さず、明細行の単価に上乗せする形で反映する。
 * 画面・PDF・合計計算はいずれも「明細行の単価 × 数量」で金額を出しているため、
 * 単価に増額を織り込んでおけば、どこも改修せずに上乗せ後の金額になる。
 *
 * 一般価格・会員価格の両方に同額を加算する。
 */

export type PlanSurcharge = {
    id: string
    planId: string
    label: string
    /** 増額。正の数で持ち、会員単価に加算する */
    amount: number
    sortNo: number
    isActive: boolean
}

export type PlanSurchargeInput = {
    id?: string | null
    label: string
    amount: number
    sortNo?: number
}

/**
 * 単価に増額を適用する。一般価格・会員価格のどちらにも同じ額を足す。
 *
 * 必ず商品マスタの価格（増額前）を基準に計算すること。
 * 明細行の現在の単価に足すと、選び直すたびに何重にも上乗せされてしまう。
 */
export function applySurchargeToPrice(basePrice: number, surchargeAmount?: number | null): number {
    if (!surchargeAmount) return basePrice
    return basePrice + surchargeAmount
}

/** 増額を選べるのは親祭壇（セット親商品）の行だけ */
export function canApplySurcharge(productItem?: { isSetParent?: boolean | null } | null): boolean {
    return !!productItem?.isSetParent
}

export async function getPlanSurcharges(planId: string): Promise<PlanSurcharge[]> {
    const response = await apiClient.get<PlanSurcharge[]>(`/plans/${planId}/surcharges`)
    return response.data
}

export async function savePlanSurcharges(
    planId: string,
    surcharges: PlanSurchargeInput[]
): Promise<PlanSurcharge[]> {
    const response = await apiClient.put<PlanSurcharge[]>(`/plans/${planId}/surcharges`, { surcharges })
    return response.data
}
