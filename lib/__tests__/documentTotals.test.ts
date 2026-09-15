import { describe, it, expect } from 'vitest'
import { calcDocumentItemAmount, calculateDocumentFormTotals, calculateDocumentTotals } from '@/lib/documentTotals'

// 明細1行の素材。テストで必要な属性だけを指定し、残りは既定値で埋める
const item = (overrides: Record<string, any> = {}) => ({
    qty: 1,
    unitPriceGeneral: 10000,
    unitPriceMember: 8000,
    productItem: {},
    ...overrides,
})

describe('calcDocumentItemAmount', () => {
    it('通常の明細は 一般価格 × 数量 で算出する', () => {
        expect(calcDocumentItemAmount(item({ qty: 3 }), 3, false)).toBe(30000)
    })

    it('会員のときは会員価格を使う', () => {
        expect(calcDocumentItemAmount(item({ qty: 3 }), 3, true)).toBe(24000)
    })

    it('数量は引数で受け取った値を優先する（入力中の数量を反映するため）', () => {
        expect(calcDocumentItemAmount(item({ qty: 1 }), 5, false)).toBe(50000)
    })

    // ── セット扱い（0円組込み）
    it('セット対象の種類が選ばれている行は 0 円になる', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(0)
        expect(calcDocumentItemAmount(setItem, 1, true)).toBe(0)
    })

    it('セット対象が会員のみの設定なら、一般では金額が立つ', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'MEMBER_ONLY' },
            productVariant: { isDefaultSet: true },
        })
        expect(calcDocumentItemAmount(setItem, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(10000)
    })

    it('セット対象外の種類が選ばれていれば金額が立つ', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: false },
        })
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(10000)
    })

    // ── サービス扱い
    it('サービス扱いの行は 0 円になる', () => {
        const serviceItem = item({
            isService: true,
            productItem: { serviceableScope: 'BOTH' },
        })
        expect(calcDocumentItemAmount(serviceItem, 1, false)).toBe(0)
    })

    it('サービス扱いでも対象スコープ外なら金額が立つ', () => {
        const serviceItem = item({
            isService: true,
            productItem: { serviceableScope: 'MEMBER_ONLY' },
        })
        expect(calcDocumentItemAmount(serviceItem, 1, false)).toBe(10000)
    })

    // ── 満期サービス扱い
    it('満期サービス扱いの行は 0 円になる', () => {
        const maturityItem = item({
            isMaturityService: true,
            productItem: { isMaturityServiceable: true },
        })
        expect(calcDocumentItemAmount(maturityItem, 1, true)).toBe(0)
    })

    // ── 書類単位の任意セット指定
    it('書類単位でセット指定された行は、指定された側でのみ 0 円になる', () => {
        const adhoc = item({ adhocSetScope: 'MEMBER_ONLY' })
        expect(calcDocumentItemAmount(adhoc, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(adhoc, 1, false)).toBe(10000)
        expect(calcDocumentItemAmount(item({ adhocSetScope: 'BOTH' }), 1, false)).toBe(0)
    })

    // ── 複数行構成商品（車種行＋距離加算行等）
    it('複数行構成商品の加算行は 一般価格 × 数量 で算出する（会員でも一般価格）', () => {
        const row = item({ productRowId: '1', calcType: 'UNIT_PRICE_X_QTY', sign: 1 })
        expect(calcDocumentItemAmount(row, 2, true)).toBe(20000)
    })

    it('複数行構成商品の返品行はマイナスで算出する', () => {
        const row = item({ productRowId: '1', calcType: 'UNIT_PRICE_X_QTY', sign: -1 })
        expect(calcDocumentItemAmount(row, 2, false)).toBe(-20000)
    })

    it('固定料金の加算行は数量によらず単価そのまま', () => {
        const row = item({ productRowId: '1', calcType: 'FIXED', sign: 1 })
        expect(calcDocumentItemAmount(row, 5, false)).toBe(10000)
    })

    it('固定料金の加算行がセット対象なら 0 円になる', () => {
        const row = item({
            productRowId: '1',
            calcType: 'FIXED',
            sign: 1,
            productItem: { isSetChild: true, setableScope: 'BOTH' },
        })
        expect(calcDocumentItemAmount(row, 1, false)).toBe(0)
    })
})

describe('画面の合計と保存される金額の整合', () => {
    // セット扱い・サービス扱いを含む明細。画面の差引合計と、
    // 保存した金額からサーバー側が算出する差引合計が一致しなければならない。
    // 過去にここがズレて、請求書PDFの備考欄だけ過大な金額が出ていた。
    const items = [
        item({ qty: 2, unitPriceGeneral: 100000, unitPriceMember: 80000 }),
        item({
            qty: 1,
            unitPriceGeneral: 50000,
            unitPriceMember: 40000,
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        }),
        item({
            qty: 1,
            unitPriceGeneral: 30000,
            unitPriceMember: 30000,
            isService: true,
            productItem: { serviceableScope: 'BOTH' },
        }),
    ]
    const customer = { memberships: [{ paymentAmount: 50000 }] }

    it.each([
        ['会員', true],
        ['一般', false],
    ])('%s の差引合計が画面と保存値で一致する', (_label, isMember) => {
        const formTotals = calculateDocumentFormTotals(items, undefined, isMember, customer)

        // 保存時に各行へ入れる金額（画面と同じ判定を通す）
        const savedItems = items.map((it) => ({ amount: calcDocumentItemAmount(it, it.qty, isMember) }))
        const apiTotals = calculateDocumentTotals(savedItems, formTotals.membershipPaidAmount)

        expect(apiTotals.subtotal).toBe(formTotals.subtotal)
        expect(apiTotals.tax).toBe(formTotals.tax)
        expect(apiTotals.grandTotal).toBe(formTotals.grandTotal)
    })

    it('セット扱い・サービス扱いの金額は合計に含まれない', () => {
        const totals = calculateDocumentFormTotals(items, undefined, true, customer)
        // 160,000（通常行のみ） + 消費税16,000 - 会費入金50,000
        expect(totals.subtotal).toBe(160000)
        expect(totals.grandTotal).toBe(126000)
    })
})

describe('消費税の端数処理', () => {
    it('画面側・API側ともに四捨五入する', () => {
        const items = [item({ qty: 1, unitPriceGeneral: 1005, unitPriceMember: 1005 })]
        const formTotals = calculateDocumentFormTotals(items, undefined, false, null)
        const apiTotals = calculateDocumentTotals([{ amount: 1005 }], 0)
        expect(formTotals.tax).toBe(101)
        expect(apiTotals.tax).toBe(101)
    })
})
