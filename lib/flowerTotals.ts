/**
 * 供花の金額計算と入金状況の判定。消費税は請求先ごとに「供花金額の合計 × 10%（四捨五入）」で求める。
 * 供花一覧画面・供花の請求書PDF・領収書PDF・入金の記録がすべてこれを使い、金額をそろえている。
 * 入金は供花1件ごと（Flower.isPaid）。
 */

export const FLOWER_TAX_RATE = 0.1

type FlowerLike = { amount: number; isPaid?: boolean }
type TargetLike = { flowers: FlowerLike[] }

const withTax = (subtotal: number) => subtotal + Math.round(subtotal * FLOWER_TAX_RATE)

/** 請求先1件の税抜合計・消費税・税込合計 */
export function calcFlowerTargetTotal(target: TargetLike) {
    const subtotal = target.flowers.reduce((sum, f) => sum + (f.amount ?? 0), 0)
    const totalWithTax = withTax(subtotal)
    return { subtotal, tax: totalWithTax - subtotal, totalWithTax }
}

/** 供花1件の税込額（入金記録の金額） */
export function calcFlowerAmountWithTax(amount: number): number {
    return withTax(amount ?? 0)
}

/**
 * 案件全体の請求額・入金額・未入金額（いずれも税抜）。
 * 供花一覧画面は明細の金額に合わせて税抜で統一している（税込は請求書・領収書PDFで出す）。
 */
export function summarizeFlowerTargets(targets: TargetLike[]) {
    let billed = 0
    let paid = 0
    for (const target of targets) {
        billed += calcFlowerTargetTotal(target).subtotal
        paid += calcFlowerTargetTotal({ flowers: target.flowers.filter((f) => f.isPaid === true) }).subtotal
    }
    return { billed, paid, unpaid: billed - paid }
}

export type FlowerPaymentFilter = 'ALL' | 'PAID' | 'UNPAID'

const matchesFilter = (flower: FlowerLike, filter: FlowerPaymentFilter) =>
    filter === 'ALL' || (filter === 'PAID' ? flower.isPaid === true : flower.isPaid !== true)

/**
 * 供花（明細）単位で絞り込む。各請求先の供花を条件に合うものだけにし、
 * 「入金済み」「未入金」では条件に合う供花が無い請求先を除く（「すべて」は供花の無い請求先も残す）。
 */
export function filterFlowerTargets<T extends TargetLike>(targets: T[], filter: FlowerPaymentFilter): T[] {
    if (filter === 'ALL') return targets
    return targets
        .map((t) => ({ ...t, flowers: t.flowers.filter((f) => matchesFilter(f, filter)) }))
        .filter((t) => t.flowers.length > 0)
}

/** 絞り込みボタンに出す供花の件数 */
export function countFlowers(targets: TargetLike[], filter: FlowerPaymentFilter): number {
    return targets.reduce((sum, t) => sum + t.flowers.filter((f) => matchesFilter(f, filter)).length, 0)
}

export type FlowerTargetPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID'

/** 請求先の入金状況（全件入金済み／一部入金／未入金）。供花が無い請求先は未入金扱い */
export function getFlowerTargetPaymentStatus(target: TargetLike): FlowerTargetPaymentStatus {
    const paidCount = target.flowers.filter((f) => f.isPaid === true).length
    if (paidCount === 0) return 'UNPAID'
    return paidCount === target.flowers.length ? 'PAID' : 'PARTIAL'
}

/** 領収書に載せる分: 請求先ごとに入金済みの供花だけにし、入金済みが無い請求先は除く */
export function selectPaidFlowersForReceipt<T extends TargetLike>(targets: T[]): T[] {
    return filterFlowerTargets(targets, 'PAID')
}
