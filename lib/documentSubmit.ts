// 見積・請求書の保存時に、画面の明細とフォームの入力値から送信する明細・自由入力行・合計を組み立てる。
// 以前は見積（新規・編集）と請求書の3か所に同じ処理の写しがあった。片方だけ直して食い違う不具合を防ぐため、
// 画面側に写しを作らないこと。
import {
    calcDocumentItemAmount,
    calculateDocumentFormTotals,
    freeItemUnitPrice,
    isFixedFreeRow,
    isMemberBenefitFreeRow,
    resolveNoChargeReason,
    resolveNoChargeScope,
} from '@/lib/documentTotals'
import { expandEachModeItems, expandVariantGroupItems, isFreeItemToSave } from '@/lib/documentUtils'
import { EXECUTION_SURCHARGE_AMOUNT, EXECUTION_SURCHARGE_NAME } from '@/lib/documentFixedRows'
import { documentActiveRows, isFreeRowParentActive } from '@/lib/documentRowVisibility'

type SubmitItem = { qty: number; description?: string | null; unitPriceGeneral: number; unitPriceMember: number; [key: string]: any }
type SubmitFreeItem = {
    productItemName?: string | null
    description?: string | null
    unitPriceGeneral: number
    unitPriceMember?: number
    qty: number
    [key: string]: any
}
type FormItem = { qty?: number; description?: string }
type FormFreeItem = { productItemName?: string; description?: string; unitPriceGeneral?: number; unitPriceMember?: number; qty?: number }

export function buildDocumentSubmitPayload<TItem extends SubmitItem, TFree extends SubmitFreeItem>({
    items,
    freeItems,
    formItems,
    formFreeItems,
    isMember,
    customer,
}: {
    items: TItem[]
    freeItems: TFree[]
    formItems: FormItem[]
    formFreeItems: FormFreeItem[]
    isMember: boolean
    customer: any
}) {
    const allMergedItems = items.map((item, i) => {
        const qty = formItems[i]?.qty ?? item.qty
        const description = formItems[i]?.description ?? item.description ?? ''
        // セット扱い・サービス扱いの行は 0 円になる。ここで単価×数量をそのまま入れると、
        // 0円扱いのはずの行まで積み上がった合計がサーバー側で算出され保存されてしまう。
        // 金額と 0 円扱いの控えは、必ず同じ明細から同時に作る（片方だけ古いと食い違う）
        const amount = calcDocumentItemAmount(item, qty, isMember)
        const noChargeScope = resolveNoChargeScope(item)
        const noChargeReason = resolveNoChargeReason(item, isMember)
        return { ...item, qty, description, amount, noChargeScope, noChargeReason }
    })
    // 画面に表示されない行（選ばれていない親祭壇の子商品など）は、数量が残っていても保存しない
    const isActiveRow = documentActiveRows(allMergedItems, (i) => Number(allMergedItems[i].qty) || 0)
    const activeItems = allMergedItems.filter((_, i) => isActiveRow[i]).map((item, i) => ({ ...item, sortNo: i }))
    const finalItems = expandEachModeItems(expandVariantGroupItems(activeItems, isMember), isMember)

    const finalFreeItems = freeItems
        .map((item, i) => {
            const productItemName = formFreeItems[i]?.productItemName ?? item.productItemName ?? ''
            // 固定行（満期サービス・施行割増券・解約手数料）には摘要欄が無い
            const description = isFixedFreeRow(productItemName)
                ? ''
                : formFreeItems[i]?.description ?? item.description ?? ''
            // 施行割増券は金額固定・編集不可のため、フォーム送信値に関わらず規定額を強制する
            const unitPriceGeneral =
                productItemName === EXECUTION_SURCHARGE_NAME
                    ? EXECUTION_SURCHARGE_AMOUNT
                    : formFreeItems[i]?.unitPriceGeneral ?? item.unitPriceGeneral
            const unitPriceMember = formFreeItems[i]?.unitPriceMember ?? item.unitPriceMember ?? 0
            const qty = formFreeItems[i]?.qty ?? item.qty
            const amount = freeItemUnitPrice({ productItemName, unitPriceGeneral, unitPriceMember }, isMember) * qty
            return { ...item, productItemName, description, unitPriceGeneral, unitPriceMember, qty, amount }
        })
        // 控室管理費などの追加行は、親商品が保存されるときだけ保存する。
        // 会員特典の固定行（満期サービス・施行割増券）は一般の書類では効かないので保存しない
        .filter(
            (fi) =>
                isFreeItemToSave(fi) &&
                isFreeRowParentActive(fi, allMergedItems, isActiveRow) &&
                (isMember || !isMemberBenefitFreeRow(fi.productItemName))
        )
        .map((it, i) => ({ ...it, sortNo: i }))

    const totals = calculateDocumentFormTotals(items, formItems, isMember, customer, freeItems, formFreeItems)
    return { items: finalItems, freeItems: finalFreeItems, totals, hasNoItems: activeItems.length === 0 }
}
