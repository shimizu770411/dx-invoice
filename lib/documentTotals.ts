import { scopeApplies } from '@/lib/productScope'
import { computeMultiRowAmount } from '@/lib/expandMultiRow'

const TAX_RATE = 0.1

type DocumentFormItem = {
    qty: number
    unitPriceGeneral: number
    unitPriceMember: number
    [key: string]: any
}

type DocumentFormItemField = {
    qty?: number
    [key: string]: any
}

type DocumentFormFreeItem = {
    unitPriceGeneral: number
    qty: number
}

type DocumentFormFreeItemField = {
    qty?: number
    unitPriceGeneral?: number
}

/**
 * 明細1行の金額を算出する。
 *
 * セット扱い（0円組込み）・サービス扱い・満期サービス扱いに該当する行は 0 円として扱い、
 * 複数行構成商品（車種行＋距離加算行等）は符号と計算方式を考慮する。
 *
 * 画面の合計・保存する明細の金額・PDFの合計が必ず同じ結果になるよう、
 * 金額の判断はここに集約している。呼び出し側で「単価×数量」と個別に計算すると、
 * 0円扱いのはずの行まで積み上がった金額が保存され、書類ごとに金額が食い違う。
 */
export function calcDocumentItemAmount(item: DocumentFormItem, qty: number, isMember: boolean): number {
    const pi = item?.productItem
    const pv = item?.productVariant
    // 複数行構成商品(車種行+距離加算行等)は、固定料金の加算行のみセット対象とする
    const isMultiRowFixedSetIncluded =
        pi?.isSetChild &&
        !!item?.productRowId &&
        item?.calcType === 'FIXED' &&
        (item?.sign ?? 1) === 1 &&
        scopeApplies(pi?.setableScope, isMember)
    const isSetIncluded =
        (pi?.isSetChild && pv?.isDefaultSet && scopeApplies(pi?.setableScope, isMember)) ||
        isMultiRowFixedSetIncluded
    const isServiceIncluded = item?.isService && scopeApplies(pi?.serviceableScope, isMember)
    const isMaturityServiceIncluded = item?.isMaturityService && pi?.isMaturityServiceable
    const adhocScope = item?.adhocSetScope
    const isAdhocSetIncluded =
        adhocScope === 'BOTH' ||
        (adhocScope === 'MEMBER_ONLY' && isMember) ||
        (adhocScope === 'GENERAL_ONLY' && !isMember)
    if (isSetIncluded || isServiceIncluded || isMaturityServiceIncluded || isAdhocSetIncluded) return 0
    if (item?.productRowId && item?.calcType) {
        return computeMultiRowAmount({
            calcType: item.calcType,
            sign: item.sign,
            unitPrice: item.unitPriceGeneral,
            qty,
        })
    }
    const unitPrice = isMember ? item.unitPriceMember : item.unitPriceGeneral
    return unitPrice * qty
}

// Hook用（商品属性・スコープ・会員/一般単価を考慮した複雑な合計計算）
export function calculateDocumentFormTotals(
    items: DocumentFormItem[],
    itemFields: DocumentFormItemField[] | undefined,
    isMember: boolean,
    customer: any,
    freeItems?: DocumentFormFreeItem[],
    freeItemFields?: DocumentFormFreeItemField[]
) {
    const regularSubtotal = items.reduce((sum, item, i) => {
        const qty = itemFields?.[i]?.qty ?? item.qty
        return sum + calcDocumentItemAmount(item, qty, isMember)
    }, 0)
    const freeSubtotal = (freeItems || []).reduce((sum, item, i) => {
        const qty = freeItemFields?.[i]?.qty ?? item.qty
        const unitPrice = freeItemFields?.[i]?.unitPriceGeneral ?? item.unitPriceGeneral
        return sum + unitPrice * qty
    }, 0)
    const subtotal = regularSubtotal + freeSubtotal
    const tax = Math.round(subtotal * TAX_RATE)
    const total = subtotal + tax
    const membershipPaidAmount =
        customer?.memberships?.reduce((sum: number, m: any) => sum + (m.paymentAmount || 0), 0) || 0
    const grandTotal = Math.max(0, total - membershipPaidAmount)
    return { subtotal, tax, total, membershipPaidAmount, grandTotal }
}

// API用（amount 計算済みの items を受け取るシンプルな合計計算）
export function calculateDocumentTotals(
    items: { amount?: number }[],
    membershipPaidAmount: number,
    freeItems: { unitPriceGeneral?: number; qty?: number }[] = []
) {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const freeSubtotal = freeItems.reduce((sum, item) => sum + (item.unitPriceGeneral || 0) * (item.qty || 1), 0)
    const subtotal = itemsSubtotal + freeSubtotal
    const tax = Math.round(subtotal * TAX_RATE)
    const total = subtotal + tax
    const grandTotal = total - membershipPaidAmount
    return {
        subtotal,
        tax,
        total,
        membershipPaidAmount,
        grandTotal: Math.max(0, grandTotal),
    }
}
