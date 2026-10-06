import type { AppliesTo } from '@/lib/products'
import { scopeApplies } from '@/lib/productScope'
import { computeMultiRowAmount } from '@/lib/expandMultiRow'
import {
    CANCELLATION_FEE_NAME,
    MATURITY_SERVICE_NAME,
    EXECUTION_SURCHARGE_NAME,
} from '@/lib/documentFixedRows'

const TAX_RATE = 0.1

type DocumentFormItem = {
    qty: number
    unitPriceGeneral: number
    unitPriceMember: number
    /** 保存時点の 0 円扱いの控え。null / 未設定 は「未記録」を意味する */
    noChargeScope?: AppliesTo | null
    noChargeReason?: NoChargeReason | null
    [key: string]: any
}

type DocumentFormItemField = {
    qty?: number
    [key: string]: any
}

type DocumentFormFreeItem = {
    productItemName?: string
    unitPriceGeneral: number
    unitPriceMember?: number
    qty: number
}

type DocumentFormFreeItemField = {
    productItemName?: string
    qty?: number
    unitPriceGeneral?: number
    unitPriceMember?: number
}

/**
 * 解約手数料は消費税の対象外で、同額の値引と相殺されるため小計にも差引合計にも含めない。
 * 書類上は合計欄に「解約手数料」「値引」の2行として金額だけを見せる。
 */
export function isCancellationFeeRow(productItemName?: string | null): boolean {
    return productItemName === CANCELLATION_FEE_NAME
}

/**
 * 互助会員にだけ効く割引のフリー行か。
 * 満期サービスは積立満期に対する特典、施行割増券は会員向けの割引券なので、
 * 一般の書類では差し引かない。
 */
export function isMemberBenefitFreeRow(productItemName?: string | null): boolean {
    return productItemName === MATURITY_SERVICE_NAME || productItemName === EXECUTION_SURCHARGE_NAME
}

type FreeItemForTotal = {
    productItemName?: string | null
    unitPriceGeneral?: number
    unitPriceMember?: number
    qty?: number
}

/** 価格を1つしか持たない固定行（満期サービス・解約手数料・施行割増券）か */
export function isFixedFreeRow(productItemName?: string | null): boolean {
    return (
        productItemName === MATURITY_SERVICE_NAME ||
        productItemName === CANCELLATION_FEE_NAME ||
        productItemName === EXECUTION_SURCHARGE_NAME
    )
}

/**
 * フリー行の単価。
 * 控室管理費の追加行・自由入力行は通常の明細と同じく、書類の会員区分で一般価格／会員価格を選ぶ。
 * 固定行は価格を1つしか持たず、一般価格の欄にその金額を入れている。
 */
export function freeItemUnitPrice(item: FreeItemForTotal, isMember: boolean): number {
    if (isFixedFreeRow(item.productItemName)) return item.unitPriceGeneral || 0
    return (isMember ? item.unitPriceMember : item.unitPriceGeneral) || 0
}

/**
 * フリー行の小計。
 * 解約手数料は消費税の対象外なので除外し、会員特典の割引は会員の書類でのみ差し引く。
 */
export function calcFreeItemsSubtotal(freeItems: FreeItemForTotal[] | undefined, isMember: boolean): number {
    return (freeItems ?? []).reduce((sum, item) => {
        if (isCancellationFeeRow(item.productItemName)) return sum
        if (!isMember && isMemberBenefitFreeRow(item.productItemName)) return sum
        return sum + freeItemUnitPrice(item, isMember) * (item.qty ?? 1)
    }, 0)
}

/**
 * 会費入金額を差し引いた差引合計。
 * 会費入金は互助会員が事前に積み立てたお金なので、会員の書類でのみ差し引く。
 * 一般の書類でこれが登録されている場合は会員区分の設定漏れなので、保存時に確認する。
 */
export function calcGrandTotal(total: number, membershipPaidAmount: number, isMember: boolean): number {
    return Math.max(0, total - (isMember ? membershipPaidAmount : 0))
}

type MembershipLike = {
    paymentAmount?: number | null
    paymentAmountOnce?: number | null
    paymentTimes?: number | null
    [key: string]: any
}

/** 案件の互助会情報の3行目。けやきは「1回の入金額 × 入金回数」ではなく割引額を直接入力する */
export const KEYAKI_ROW_INDEX = 2

export type MembershipPaymentRow = {
    /** 案件の互助会情報の何行目か（0始まり） */
    rowIndex: number
    /** 書類に出す金額 */
    amount: number
    membership: MembershipLike
}

/**
 * 書類の合計欄に出す「会費入金額」の内訳行。
 *
 * 互助会員（1・2行目）は 1回の入金額 × 入金回数。案件登録画面の入金額欄は
 * この式の自動計算で編集できないため、登録値と必ず一致する。
 * けやき（3行目）は手入力の割引額をそのまま出す。この行だけ入金回数と単価に連動しない。
 *
 * 帳票ごとに別の式を書くと内訳の金額が食い違うので、請求書・領収書ともここを使う。
 */
export function buildMembershipPaymentRows(memberships?: MembershipLike[] | null): MembershipPaymentRow[] {
    return (memberships ?? [])
        .map((membership, rowIndex) => {
            const amount =
                rowIndex === KEYAKI_ROW_INDEX
                    ? membership?.paymentAmount ?? null
                    : membership?.paymentAmountOnce != null && membership?.paymentTimes != null
                      ? membership.paymentAmountOnce * membership.paymentTimes
                      : null
            return { rowIndex, amount, membership }
        })
        .filter((row): row is MembershipPaymentRow => row.amount != null)
}

/**
 * 書類の差引合計から控除する会費入金の合計。
 * 控除額は登録された入金額（paymentAmount）で決まる。
 * 互助会員の入金額欄は自動計算で編集できないため、内訳行に出る金額と一致する。
 */
export function sumMembershipPaidAmount(memberships?: MembershipLike[] | null): number {
    return (memberships ?? []).reduce((sum, m) => sum + (m?.paymentAmount || 0), 0)
}

/**
 * 明細が 0 円扱いになる理由。帳票の金額欄には、この区分に応じた文字を金額の代わりに印字する。
 */
export type NoChargeReason = 'SET' | 'SERVICE' | 'MATURITY_SERVICE'

/** 0円扱いの理由と、帳票に印字する文言の対応 */
export const NO_CHARGE_LABELS: Record<NoChargeReason, string> = {
    SET: 'セット',
    SERVICE: 'サービス',
    MATURITY_SERVICE: '満期サービス',
}

/**
 * 明細1行が 0 円扱いになるかを、商品マスタとプラン別設定の現在値から判定する。
 * 課金対象なら null を返す。
 *
 * 判定材料（子商品か・初期セット品か・適用範囲）は商品マスタ側にあるため、同じ明細でも
 * 設定を変えれば結果が変わる。画面・保存・PDFがそれぞれ独自に判定すると必ず食い違うので、
 * 判定はここに集約し、呼び出し側では条件を書かない。
 *
 * 複数の理由に該当する場合の優先順位は 満期サービス > サービス > セット。帳票の文言もこの順で決まる。
 */
export function computeNoChargeFor(item: DocumentFormItem, isMember: boolean): NoChargeReason | null {
    const pi = item?.productItem
    const pv = item?.productVariant
    // 満期サービスは互助会員の積立満期に対する特典のため、会員の書類でのみ 0 円にする
    if (item?.isMaturityService && pi?.isMaturityServiceable && isMember) return 'MATURITY_SERVICE'
    if (item?.isService && scopeApplies(pi?.serviceableScope, isMember)) return 'SERVICE'
    // 複数行構成商品(車種行+距離加算行等)は、固定料金の加算行のみセット対象とする
    if (
        pi?.isSetChild &&
        !!item?.productRowId &&
        item?.calcType === 'FIXED' &&
        (item?.sign ?? 1) === 1 &&
        scopeApplies(pi?.setableScope, isMember)
    ) {
        return 'SET'
    }
    if (pi?.isSetChild && pv?.isDefaultSet && scopeApplies(pi?.setableScope, isMember)) return 'SET'
    // 書類単位の任意セット指定。子商品のセット可否は商品マスタ側の設定で決まるため対象外
    if (!pi?.isSetChild && scopeApplies(item?.adhocSetScope, isMember)) return 'SET'
    return null
}

/**
 * 明細1行が 0 円扱いか。
 *
 * 保存時の控えがあればそれを使い、無い場合（控えを持たせる前に作られた書類）だけ
 * 現在の設定から判定し直す。これにより、発行済み書類の金額が商品マスタやプラン設定の
 * 後からの変更で動かなくなる。
 */
export function isNoChargeFor(item: DocumentFormItem, isMember: boolean): boolean {
    // 未記録（null）と「課金と記録済み」（NONE）は意味が違う。
    // ここを緩めて NONE もフォールバックに落とすと、控えを持たせた意味が無くなる
    if (item?.noChargeScope != null) return scopeApplies(item.noChargeScope, isMember)
    return computeNoChargeFor(item, isMember) !== null
}

/**
 * 帳票の金額欄に金額の代わりに印字する区分。課金対象なら null。
 *
 * 理由は現在の設定から引ける場合はそれを使う（会員列と一般列で理由が異なる書類でも
 * それぞれ正しく出せる）。設定が変わって引けなくなったときだけ控えの理由を使う。
 * 金額そのものは控えで決まるため、ここでの取り違えが請求額に影響することはない。
 */
export function noChargeReasonFor(item: DocumentFormItem, isMember: boolean): NoChargeReason | null {
    if (!isNoChargeFor(item, isMember)) return null
    return computeNoChargeFor(item, isMember) ?? item?.noChargeReason ?? 'SET'
}

/**
 * 保存する控え（0円扱いの範囲）。
 * 既に控えがあればそのまま引き継ぎ、無ければ現在の設定から算出する。
 * 種類の変更などで判定材料が変わったときは、呼び出し側が控えを null に戻しておく。
 */
export function resolveNoChargeScope(item: DocumentFormItem): AppliesTo {
    return item?.noChargeScope ?? computeNoChargeScope(item)
}

/** 保存する控え（0円扱いの理由）。書類の会員区分での理由を控える */
export function resolveNoChargeReason(item: DocumentFormItem, isMember: boolean): NoChargeReason | null {
    if (item?.noChargeScope != null) return item?.noChargeReason ?? null
    return computeNoChargeFor(item, isMember)
}

/**
 * 判定材料が変わった明細から控えを外す。種類の変更・複数選択・グループ選択・プラン切替のように、
 * 0円扱いかどうかが変わりうる操作のたびに通す。外し忘れると「種類を変えたのに 0 円のまま」になる。
 */
export function clearNoChargeSnapshot<T>(item: T): T & { noChargeScope: null; noChargeReason: null } {
    return { ...item, noChargeScope: null, noChargeReason: null }
}

/**
 * 会員・一般それぞれで判定し、0 円扱いになる範囲を返す。
 * 保存時にこれを明細へ控えておくと、後から商品マスタやプラン設定を変えても
 * 発行済み書類の金額が動かなくなる。
 */
export function computeNoChargeScope(item: DocumentFormItem): AppliesTo {
    const forMember = isNoChargeFor(item, true)
    const forGeneral = isNoChargeFor(item, false)
    if (forMember && forGeneral) return 'BOTH'
    if (forMember) return 'MEMBER_ONLY'
    if (forGeneral) return 'GENERAL_ONLY'
    return 'NONE'
}

/**
 * 明細1行の金額を算出する。
 *
 * 0 円扱いの行は 0 円とし、複数行構成商品（車種行＋距離加算行等）は符号と計算方式を考慮する。
 *
 * 画面の合計・保存する明細の金額・PDFの合計が必ず同じ結果になるよう、
 * 金額の判断はここに集約している。呼び出し側で「単価×数量」と個別に計算すると、
 * 0円扱いのはずの行まで積み上がった金額が保存され、書類ごとに金額が食い違う。
 */
export function calcDocumentItemAmount(item: DocumentFormItem, qty: number, isMember: boolean): number {
    if (isNoChargeFor(item, isMember)) return 0
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
    // 入力中の値（フォーム側）を優先してから小計を出す
    const mergedFreeItems = (freeItems || []).map((item, i) => ({
        productItemName: freeItemFields?.[i]?.productItemName ?? item.productItemName,
        unitPriceGeneral: freeItemFields?.[i]?.unitPriceGeneral ?? item.unitPriceGeneral,
        unitPriceMember: freeItemFields?.[i]?.unitPriceMember ?? item.unitPriceMember,
        qty: freeItemFields?.[i]?.qty ?? item.qty,
    }))
    const freeSubtotal = calcFreeItemsSubtotal(mergedFreeItems, isMember)
    const subtotal = regularSubtotal + freeSubtotal
    const tax = Math.round(subtotal * TAX_RATE)
    const total = subtotal + tax
    const membershipPaidAmount = sumMembershipPaidAmount(customer?.memberships)
    const grandTotal = calcGrandTotal(total, membershipPaidAmount, isMember)
    return { subtotal, tax, total, membershipPaidAmount, grandTotal }
}

// API用（amount 計算済みの items を受け取るシンプルな合計計算）
// 会員特典（会費入金の控除・満期サービス・施行割増券）の適用可否が変わるため、
// 書類の会員区分を必ず渡す
export function calculateDocumentTotals(
    items: { amount?: number }[],
    membershipPaidAmount: number,
    freeItems: FreeItemForTotal[] = [],
    isMember: boolean
) {
    const itemsSubtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    const freeSubtotal = calcFreeItemsSubtotal(freeItems, isMember)
    const subtotal = itemsSubtotal + freeSubtotal
    const tax = Math.round(subtotal * TAX_RATE)
    const total = subtotal + tax
    return {
        subtotal,
        tax,
        total,
        membershipPaidAmount,
        grandTotal: calcGrandTotal(total, membershipPaidAmount, isMember),
    }
}
