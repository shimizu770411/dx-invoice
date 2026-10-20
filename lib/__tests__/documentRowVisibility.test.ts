import { describe, it, expect } from 'vitest'
import { documentActiveFreeRows, documentActiveRows, documentRowVisibility } from '@/lib/documentRowVisibility'

/**
 * 画面に表示されない行は、合計にも保存にも入れない。
 * 以前は表示されなくなった行の数量を裏で0にしていたため、親の数量を戻すと子商品が数量0で出てきた。
 */
const altarA = { productItemId: 1, productItem: { isSetParent: true, children: [{ id: 10 }, { id: 11 }] } }
const altarB = { productItemId: 2, productItem: { isSetParent: true, children: [{ id: 11 }] } }
const coffin = { productItemId: 10, productItem: { isSetChild: true } }
const urn = { productItemId: 11, productItem: { isSetChild: true } }
const forcedSet = { productItemId: 20, productItem: { isSetChild: true, isPlanForcedSet: true } }
const roomFee = { productItemId: 30, productItem: {} }
const items = [altarA, altarB, coffin, urn, forcedSet, roomFee]
const qtys = (values: number[]) => (i: number) => values[i] ?? 0

describe('画面に表示される行', () => {
    it('親祭壇が選ばれていなければ、親祭壇はすべて表示し、子のセット商品は表示しない', () => {
        expect(documentRowVisibility(items, qtys([0, 0, 1, 1, 0, 0]))).toEqual([true, true, false, false, true, true])
    })

    it('親祭壇が選ばれていれば、ほかの親祭壇は表示せず、紐づく子だけ表示する', () => {
        expect(documentRowVisibility(items, qtys([1, 0, 1, 1, 0, 0]))).toEqual([true, false, true, true, true, true])
        expect(documentRowVisibility(items, qtys([0, 1, 1, 1, 0, 0]))).toEqual([false, true, false, true, true, true])
    })

    it('プラン設定で疑似セット化された一般商品は、親祭壇に関係なく表示する', () => {
        expect(documentRowVisibility(items, qtys([0, 0, 0, 0, 1, 0]))[4]).toBe(true)
    })
})

describe('書類に載る行', () => {
    it('親祭壇の数量が0の間は、数量が残っている子商品も載せない', () => {
        expect(documentActiveRows(items, qtys([0, 0, 1, 1, 0, 1]))).toEqual([false, false, false, false, false, true])
    })

    it('親祭壇の数量を戻すと、残っていた子商品の数量でそのまま載る', () => {
        expect(documentActiveRows(items, qtys([1, 0, 2, 1, 0, 0]))).toEqual([true, false, true, true, false, false])
    })
})

describe('追加行（親商品つきの自由入力行）', () => {
    const freeItems = [{ parentProductItemId: 30 }, { parentProductItemId: null }, {}]

    it('親商品が載らなければ、追加行も載せない。親の無い自由行は対象のまま', () => {
        const active = documentActiveRows(items, qtys([0, 0, 0, 0, 0, 0]))
        expect(documentActiveFreeRows(freeItems, items, active)).toEqual([false, true, true])
    })

    it('親商品が載れば、追加行も対象', () => {
        const active = documentActiveRows(items, qtys([0, 0, 0, 0, 0, 1]))
        expect(documentActiveFreeRows(freeItems, items, active)).toEqual([true, true, true])
    })
})
