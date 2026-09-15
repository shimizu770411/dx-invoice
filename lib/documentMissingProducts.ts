/**
 * 商品マスタから消えた商品の明細を、見積・請求書・PDFから取りこぼさないためのユーティリティ。
 *
 * 見積編集画面・請求書編集画面・各PDFは、現行の商品マスタ（有効な商品だけを返す一覧API）を
 * ループしながら保存済み明細を突き合わせて表示行を作っている。
 * そのため商品を無効化すると、金額が保存されている明細でも行が現れなくなる。
 * さらに編集画面は表示された明細だけを保存し直すため、開いて保存すると明細が消えたまま確定してしまう。
 *
 * 商品マスタをループする構造自体は
 *   - 編集画面が「全商品を並べたチェックリスト」であること
 *   - 領収書PDFが未選択の商品も空行として出力する様式であること
 * のために必要なので、ループ対象のリストに「マスタから消えた商品」を補う形で対処する。
 *
 * 補う商品の定義は、書類取得APIが明細に添えて返す商品リレーションから取る。
 * このリレーションは有効フラグでフィルタされないため、無効化された商品でも取得できる。
 */

/** 商品マスタから消えた商品であることを示す印。種類の選び直しをさせないなど、UI側の判定に使う */
export const MISSING_FROM_MASTER_LABEL = 'マスタ削除済み'

type ProductLike = {
    id: string
    /** 商品マスタから消えた商品を補ったものかどうか */
    isMissingFromMaster?: boolean
}

type ItemLike = {
    productItemId?: string | null
    productItem?: unknown
}

/**
 * 現行の商品マスタのリストに、書類の明細が参照していてマスタに無い商品を末尾へ補う。
 *
 * @param masterProducts 商品一覧APIが返した現行マスタ（表示順はそのまま保つ）
 * @param items 書類の保存済み明細（`productItem` に保存時の商品定義を持つ）
 */
export function withProductsMissingFromMaster<P extends ProductLike>(
    masterProducts: P[],
    items: ItemLike[]
): P[] {
    const knownIds = new Set(masterProducts.map((product) => String(product.id)))
    const missing: P[] = []
    for (const item of items ?? []) {
        const productItemId = item.productItemId ? String(item.productItemId) : ''
        if (!productItemId || knownIds.has(productItemId)) continue
        // 明細に商品定義が添えられていない場合は行を作れないため補えない
        if (!item.productItem) continue
        knownIds.add(productItemId)
        missing.push({
            ...(item.productItem as P),
            id: productItemId,
            isMissingFromMaster: true,
        })
    }
    return missing.length > 0 ? [...masterProducts, ...missing] : masterProducts
}
