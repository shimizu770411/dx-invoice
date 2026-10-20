import { describe, it, expect } from 'vitest'
import {
    calcDocumentItemAmount,
    calculateDocumentFormTotals,
    calculateDocumentTotals,
    isMemberBenefitFreeRow,
    sumMembershipPaidAmount,
} from '@/lib/documentTotals'
import { buildDocumentSubmitPayload } from '@/lib/documentSubmit'
import { documentRowVisibility } from '@/lib/documentRowVisibility'
import {
    CANCELLATION_FEE_NAME,
    EXECUTION_SURCHARGE_AMOUNT,
    EXECUTION_SURCHARGE_NAME,
    MATURITY_SERVICE_NAME,
} from '@/lib/documentFixedRows'

/**
 * 見積・請求書の明細を乱数で大量に作り、画面・保存・PDF の3者で金額や保存対象が食い違わないことを確かめる。
 * 手で書いたテストでは思いつかない組み合わせ（親祭壇と子商品、複数行構成商品の返品行、重箱、
 * 種類ごとに分かれる複数選択、追加行、0円扱いの控え、会員・一般）を機械的に試すためのもの。
 *
 * 乱数の種は固定しているので、毎回同じ明細で試す。落ちたときは、メッセージの「種・番号」で同じ明細を再現できる。
 * 種を変えて試したいときは、環境変数 DOC_RANDOM_SEED / DOC_RANDOM_CASES を指定する。
 *
 * 確かめる約束:
 *  1. 画面の合計（入力中の値から出す）＝ 保存後にサーバーが出す合計（保存する明細の金額から出す）
 *  2. 保存する明細の金額 ＝ PDF が明細ごとに出し直す金額
 *  3. 画面に表示されない行（選ばれていない親祭壇の子商品など）は保存しない
 *  4. 追加行（親商品つきの自由入力行）は、親商品を保存するときだけ保存する
 *  5. 一般の書類には、会員特典の固定行（満期サービス・施行割増券）を保存しない
 *  6. 表示されない行の数量を変えても、画面の合計は変わらない
 */

const SEED = Number(process.env.DOC_RANDOM_SEED ?? 20261020)
const CASES = Number(process.env.DOC_RANDOM_CASES ?? 2000)

// 種から決まる乱数（mulberry32）
function makeRandom(seed: number) {
    let a = seed >>> 0
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
    const pick = <T,>(values: readonly T[]): T => values[int(0, values.length - 1)]
    const bool = (p = 0.5) => next() < p
    const subset = <T,>(values: readonly T[]) => values.filter(() => bool(0.5))
    return { int, pick, bool, subset }
}
type Random = ReturnType<typeof makeRandom>

const SCOPES = ['NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const
// 控えは多くの明細で「未記録（null）」なので、未記録を多めに出す
const SNAPSHOTS = [null, null, null, 'NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const
const QTYS = [0, 0, 0, 1, 1, 2, 3, 200] as const
const price = (r: Random) => r.pick([0, 1000, 3000, 15000, 120000])

function makeVariants(r: Random, count: number, idBase: number) {
    return Array.from({ length: count }, (_, k) => {
        const general = price(r)
        return {
            id: String(idBase + k),
            name: `種類${idBase + k}`,
            priceGeneral: general,
            priceMember: r.bool(0.5) ? general : Math.floor(general * 0.8),
            isDefaultSet: r.bool(0.4),
        }
    })
}

// 1件分の書類（画面の明細・自由入力行・フォームの入力値）を作る
function makeDocument(r: Random) {
    let nextId = 1
    const id = () => String(nextId++)
    const items: any[] = []
    const isMember = r.bool(0.6)

    // 単一の種類を選ぶ商品の画面の行。単価は選んだ種類の価格
    const singleItem = (productItem: any) => {
        const variant = r.pick(productItem.variants as any[])
        return {
            productItemId: productItem.id,
            productItem,
            productVariantId: variant.id,
            productVariant: variant,
            unitPriceGeneral: variant.priceGeneral,
            unitPriceMember: variant.priceMember,
            qty: 0,
            isService: r.bool(0.2),
            isMaturityService: r.bool(0.15),
            adhocSetScope: productItem.isSetChild ? 'NONE' : r.pick(['NONE', 'NONE', 'NONE', 'MEMBER_ONLY', 'BOTH']),
            noChargeScope: r.pick(SNAPSHOTS),
            noChargeReason: null,
        }
    }
    const commonFlags = () => ({
        serviceableScope: r.pick(SCOPES),
        setableScope: r.pick(SCOPES),
        isMaturityServiceable: r.bool(0.3),
    })

    // 子のセット商品と、それらを束ねる親祭壇2つ
    const children = Array.from({ length: 4 }, () => {
        const pid = id()
        return { id: pid, name: `子${pid}`, isSetChild: true, isPlanForcedSet: r.bool(0.2), variants: makeVariants(r, 3, Number(pid) * 10), ...commonFlags() }
    })
    const parents = Array.from({ length: 2 }, () => {
        const pid = id()
        return {
            id: pid,
            name: `親祭壇${pid}`,
            isSetParent: true,
            children: r.subset(children).map((c) => ({ id: c.id, name: c.name })),
            variants: makeVariants(r, 2, Number(pid) * 10),
            ...commonFlags(),
        }
    })
    for (const p of parents) items.push(singleItem(p))
    for (const c of children) items.push(singleItem(c))

    // 通常の商品（一部は控室管理費のように追加行を持つ）
    const normals = Array.from({ length: 3 }, () => {
        const pid = id()
        return { id: pid, name: `商品${pid}`, canAddFreeRow: r.bool(0.4), variants: makeVariants(r, 2, Number(pid) * 10), ...commonFlags() }
    })
    for (const n of normals) items.push(singleItem(n))

    // 複数行構成商品（霊柩車・御供養のように、固定料金の行・数量の行・返品行を持つ）。親祭壇の子にもなりうる
    const multiRowId = id()
    const multiRowIsChild = r.bool(0.5)
    const multiRowProduct = { id: multiRowId, name: `複数行${multiRowId}`, isMultiRow: true, isSetChild: multiRowIsChild, ...commonFlags() }
    if (multiRowIsChild) parents[0].children.push({ id: multiRowId, name: multiRowProduct.name })
    for (let row = 0; row < r.int(1, 2); row++) {
        const calcType = r.pick(['FIXED', 'UNIT_PRICE_X_QTY'] as const)
        const unitPrice = price(r)
        for (const sign of r.bool(0.5) ? [1, -1] : [1]) {
            items.push({
                productItemId: multiRowId,
                productItem: multiRowProduct,
                productRowId: `${multiRowId}-${row}`,
                calcType,
                sign,
                unitPriceGeneral: unitPrice,
                unitPriceMember: unitPrice,
                qty: 0,
                isService: r.bool(0.1),
                noChargeScope: r.pick(SNAPSHOTS),
                noChargeReason: null,
            })
        }
    }

    // 重箱のように、種類のグループから選ぶ商品。画面の代表行の単価は選んだ種類の合計（会員切替の再計算と同じ）
    const groupId = id()
    const variantGroups = Array.from({ length: 2 }, (_, g) => ({
        id: `${groupId}-g${g}`,
        selectionType: r.pick(['SINGLE', 'MULTI'] as const),
        mergeDisplay: r.bool(0.7),
        variants: makeVariants(r, 3, Number(groupId) * 100 + g * 10),
    }))
    const selections: Record<string, string[]> = {}
    for (const g of variantGroups) {
        const ids = g.variants.map((v) => v.id)
        selections[g.id] = g.selectionType === 'SINGLE' ? (r.bool(0.7) ? [r.pick(ids)] : []) : r.subset(ids)
    }
    const selectedGroupVariants = variantGroups.flatMap((g) => g.variants.filter((v) => selections[g.id].includes(v.id)))
    items.push({
        productItemId: groupId,
        productItem: { id: groupId, name: '重箱', hasVariantGroups: true, variantGroups, ...commonFlags() },
        groupSelections: JSON.stringify(selections),
        unitPriceGeneral: selectedGroupVariants.reduce((s, v) => s + v.priceGeneral, 0),
        unitPriceMember: selectedGroupVariants.reduce((s, v) => s + v.priceMember, 0),
        qty: 0,
        isService: r.bool(0.1),
        adhocSetScope: r.pick(['NONE', 'NONE', 'MEMBER_ONLY', 'BOTH']),
        noChargeScope: null,
    })

    // 種類ごとに別の行で保存する複数選択商品。画面の行の単価は選んだ種類の合計
    const eachId = id()
    const eachVariants = makeVariants(r, 3, Number(eachId) * 10)
    const eachSelected = r.subset(eachVariants)
    items.push({
        productItemId: eachId,
        productItem: { id: eachId, name: '複数選択', isMultiSelect: true, multiSelectMerge: false, variants: eachVariants, ...commonFlags() },
        multiSelectVariantIds: eachSelected.length > 0 ? JSON.stringify(eachSelected.map((v) => v.id)) : null,
        productVariantId: eachSelected[0]?.id,
        productVariant: eachSelected[0] ?? null,
        unitPriceGeneral: eachSelected.reduce((s, v) => s + v.priceGeneral, 0),
        unitPriceMember: eachSelected.reduce((s, v) => s + v.priceMember, 0),
        qty: 0,
        isService: r.bool(0.1),
        adhocSetScope: r.pick(['NONE', 'NONE', 'MEMBER_ONLY', 'BOTH']),
        noChargeScope: null,
    })

    // 入力中の数量（画面の明細の数量は読み込み時点の値で、入力値はフォーム側にある）
    const formItems = items.map(() => ({ qty: r.pick(QTYS), description: '' }))

    // 自由入力行: 固定行・通常の自由行・追加行
    const freeItems: any[] = [
        { productItemName: MATURITY_SERVICE_NAME, unitPriceGeneral: -r.pick([0, 10000, 20000]), unitPriceMember: 0, qty: r.pick([0, 1]) },
        { productItemName: EXECUTION_SURCHARGE_NAME, unitPriceGeneral: EXECUTION_SURCHARGE_AMOUNT, unitPriceMember: 0, qty: r.pick([0, 1]) },
    ]
    if (r.bool(0.5)) {
        freeItems.push({ productItemName: CANCELLATION_FEE_NAME, unitPriceGeneral: r.pick([0, 30000]), unitPriceMember: 0, qty: r.pick([0, 1]) })
    }
    for (let k = 0; k < 3; k++) {
        freeItems.push({
            productItemName: r.pick(['', '', '自由品目']),
            unitPriceGeneral: r.pick([0, 5000, -3000]),
            unitPriceMember: r.pick([0, 4000, -3000]),
            qty: r.pick([0, 0, 1, 2]),
        })
    }
    for (const n of normals.filter((p) => p.canAddFreeRow)) {
        freeItems.push({
            parentProductItemId: n.id,
            productItemName: r.pick(['', '追加']),
            unitPriceGeneral: r.pick([0, 5000]),
            unitPriceMember: r.pick([0, 4000]),
            qty: r.pick([0, 1, 2]),
        })
    }
    const formFreeItems = freeItems.map((fi) => ({
        parentProductItemId: fi.parentProductItemId ?? null,
        productItemName: fi.productItemName,
        description: '',
        unitPriceGeneral: fi.unitPriceGeneral,
        unitPriceMember: fi.unitPriceMember,
        qty: fi.qty,
    }))
    const customer = { memberships: r.bool(0.5) ? [{ paymentAmount: r.pick([0, 50000, 300000]) }] : [] }
    return { items, formItems, freeItems, formFreeItems, isMember, customer }
}

const pickTotals = (t: { subtotal: number; tax: number; total: number; grandTotal: number }) => ({
    subtotal: t.subtotal,
    tax: t.tax,
    total: t.total,
    grandTotal: t.grandTotal,
})

describe(`見積・請求書の明細を乱数で ${CASES} 件作り、画面・保存・PDFが食い違わないこと（種 ${SEED}）`, () => {
    it('6つの約束がすべての明細で成り立つ', () => {
        const r = makeRandom(SEED)
        for (let n = 0; n < CASES; n++) {
            const doc = makeDocument(r)
            const where = `種 ${SEED}・${n} 件目（会員: ${doc.isMember}）`
            const screen = calculateDocumentFormTotals(doc.items, doc.formItems, doc.isMember, doc.customer, doc.freeItems, doc.formFreeItems)
            const payload = buildDocumentSubmitPayload({
                items: doc.items,
                freeItems: doc.freeItems,
                formItems: doc.formItems,
                formFreeItems: doc.formFreeItems,
                isMember: doc.isMember,
                customer: doc.customer,
            })
            if (payload.hasNoItems) continue

            // 1. 画面の合計 ＝ 保存後にサーバーが出す合計
            const server = calculateDocumentTotals(
                payload.items,
                sumMembershipPaidAmount(doc.customer.memberships),
                payload.freeItems,
                doc.isMember
            )
            expect(pickTotals(server), `${where}: 画面の合計とサーバーの合計`).toEqual(pickTotals(screen))

            // 2. 保存する明細の金額 ＝ PDF が明細ごとに出し直す金額
            for (const saved of payload.items as any[]) {
                expect(calcDocumentItemAmount(saved, saved.qty, doc.isMember), `${where}: 「${saved.productItem?.name}」の保存金額とPDFの金額`).toBe(saved.amount)
            }

            // 3. 表示されない行は保存しない
            const qtyOf = (i: number) => Number(doc.formItems[i]?.qty ?? doc.items[i].qty) || 0
            const visible = documentRowVisibility(doc.items, qtyOf)
            const hiddenIds = new Set(doc.items.filter((_, i) => !visible[i]).map((it) => String(it.productItemId)))
            const savedIds = new Set((payload.items as any[]).map((it) => String(it.productItemId)))
            for (const hid of hiddenIds) expect(savedIds.has(hid), `${where}: 表示されない商品 ${hid} が保存される`).toBe(false)

            // 4. 追加行は、親商品を保存するときだけ保存する
            for (const fi of payload.freeItems as any[]) {
                if (!fi.parentProductItemId) continue
                expect(savedIds.has(String(fi.parentProductItemId)), `${where}: 親商品 ${fi.parentProductItemId} の無い追加行が保存される`).toBe(true)
            }

            // 5. 一般の書類には会員特典の固定行を保存しない
            if (!doc.isMember) {
                const benefit = (payload.freeItems as any[]).filter((fi) => isMemberBenefitFreeRow(fi.productItemName))
                expect(benefit, `${where}: 一般の書類に会員特典の行が保存される`).toEqual([])
            }

            // 6. 表示されない行の数量を変えても、画面の合計は変わらない。
            // 表示されない親祭壇は画面で操作できず数量0のままなので、変えるのは子商品などの行だけ
            // （親祭壇の数量を変えると、選ばれている親祭壇そのものが入れ替わる）
            const changedForm = doc.formItems.map((f, i) =>
                visible[i] || doc.items[i].productItem?.isSetParent ? f : { ...f, qty: r.pick(QTYS) }
            )
            const screenAfterHiddenChange = calculateDocumentFormTotals(doc.items, changedForm, doc.isMember, doc.customer, doc.freeItems, doc.formFreeItems)
            expect(pickTotals(screenAfterHiddenChange), `${where}: 表示されない行の数量で合計が変わる`).toEqual(pickTotals(screen))
        }
        // 件数を増やして流すときは時間がかかるため、件数に応じて制限時間を延ばす（2000件で約1秒）
    }, Math.max(5000, CASES * 2))
})
