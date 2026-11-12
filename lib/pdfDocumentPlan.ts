import { getProductPlanSettings, applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import { withProductsMissingFromMaster } from '@/lib/documentMissingProducts'
import type { ProductItem } from '@/lib/products'

/**
 * 見積・請求書・領収書のPDFで、書類の明細と商品リストにプラン別商品設定を反映する。
 *
 * 金額欄の「セット」「サービス」表示は明細の商品情報（初期セット品か・適用範囲など）から判定するため、
 * プラン別の上書きを反映しないまま判定すると、書類によって表示が食い違う。
 * 3種類のPDFが同じ下準備を通るよう、ここに集約する。
 *
 * プラン設定の取得に失敗しても、PDF自体は元データのまま表示できるようにフォールバックする。
 */
export async function applyPlanToPdfDocument<D extends { planId?: string | null; items?: any[] }>(
    doc: D,
    products: ProductItem[]
): Promise<{ document: D; products: ProductItem[] }> {
    let overriddenProducts = products
    try {
        const planId = doc.planId || BASE_PLAN_ID
        const planSettings = await getProductPlanSettings(planId)
        overriddenProducts = applyPlanOverrides(products, planSettings)
    } catch (planError) {
        console.error('Failed to apply plan overrides:', planError)
    }

    // 商品マスタから消えた商品（無効化された商品など）の明細もPDFに出るよう、
    // 保存済み明細が参照している商品を商品リストに補う
    overriddenProducts = withProductsMissingFromMaster(overriddenProducts, doc.items || [])

    const overriddenProductMap = new Map(overriddenProducts.map((p) => [p.id, p]))
    const document = {
        ...doc,
        items: (doc.items || []).map((item: any) => {
            const overridden = item.productItemId ? overriddenProductMap.get(item.productItemId) : undefined
            if (!overridden) return item
            // productItem.variants内のisDefaultSet上書きは、明細行が選択中の productVariant 自体にも反映する必要がある
            const overriddenVariant = item.productVariantId
                ? overridden.variants?.find((v: any) => v.id === item.productVariantId)
                : undefined
            return {
                ...item,
                productItem: overridden,
                productVariant: overriddenVariant ?? item.productVariant,
            }
        }),
    }
    return { document, products: overriddenProducts }
}
