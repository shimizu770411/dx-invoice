import { describe, it, expect } from 'vitest'
import {
    calcFlowerAmountWithTax,
    calcFlowerTargetTotal,
    countFlowers,
    filterFlowerTargets,
    getFlowerTargetPaymentStatus,
    selectPaidFlowersForReceipt,
    summarizeFlowerTargets,
} from '../flowerTotals'

const flower = (amount: number, isPaid = false) => ({ amount, isPaid })

describe('calcFlowerTargetTotal', () => {
    it('請求先ごとに税抜合計の10%を四捨五入して税込にする（PDFと同じ計算）', () => {
        expect(calcFlowerTargetTotal({ flowers: [flower(15000), flower(20000)] })).toEqual({
            subtotal: 35000,
            tax: 3500,
            totalWithTax: 38500,
        })
        expect(calcFlowerTargetTotal({ flowers: [flower(12345)] })).toEqual({ subtotal: 12345, tax: 1235, totalWithTax: 13580 })
    })

    it('供花が無い請求先は0円', () => {
        expect(calcFlowerTargetTotal({ flowers: [] })).toEqual({ subtotal: 0, tax: 0, totalWithTax: 0 })
    })
})

describe('calcFlowerAmountWithTax', () => {
    it('供花1件の税込額（入金記録の金額）', () => {
        expect(calcFlowerAmountWithTax(15000)).toBe(16500)
        expect(calcFlowerAmountWithTax(12345)).toBe(13580)
    })
})

describe('summarizeFlowerTargets', () => {
    it('画面の合計は明細に合わせて税抜。入金額は入金済みの供花だけ（一部入金）', () => {
        const summary = summarizeFlowerTargets([
            { flowers: [flower(15000, true), flower(20000, false)] }, // 請求 35,000 / 入金 15,000
            { flowers: [flower(10000, false)] }, // 請求 10,000 / 入金 0
        ])
        expect(summary).toEqual({ billed: 45000, paid: 15000, unpaid: 30000 })
    })

    it('請求先の供花を全部入金すると未入金は0になる', () => {
        const summary = summarizeFlowerTargets([{ flowers: [flower(12345, true), flower(12345, true)] }])
        expect(summary).toEqual({ billed: 24690, paid: 24690, unpaid: 0 })
    })

    it('請求先が無ければすべて0', () => {
        expect(summarizeFlowerTargets([])).toEqual({ billed: 0, paid: 0, unpaid: 0 })
    })
})

describe('明細単位の絞り込み', () => {
    const targets = [
        { id: 'a', flowers: [flower(10000, true), flower(20000, false)] },
        { id: 'b', flowers: [flower(30000, true)] },
        { id: 'c', flowers: [flower(40000, false)] },
        { id: 'd', flowers: [] as { amount: number; isPaid: boolean }[] },
    ]

    it('すべて: 請求先も供花もそのまま（供花の無い請求先も残す）', () => {
        expect(filterFlowerTargets(targets, 'ALL').map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('入金済み: 入金済みの供花だけを残し、それが無い請求先は出さない', () => {
        const result = filterFlowerTargets(targets, 'PAID')
        expect(result.map((t) => [t.id, t.flowers.map((f) => f.amount)])).toEqual([
            ['a', [10000]],
            ['b', [30000]],
        ])
    })

    it('未入金: 未入金の供花だけを残す', () => {
        const result = filterFlowerTargets(targets, 'UNPAID')
        expect(result.map((t) => [t.id, t.flowers.map((f) => f.amount)])).toEqual([
            ['a', [20000]],
            ['c', [40000]],
        ])
    })

    it('ボタンの件数は供花の件数', () => {
        expect(countFlowers(targets, 'ALL')).toBe(4)
        expect(countFlowers(targets, 'PAID')).toBe(2)
        expect(countFlowers(targets, 'UNPAID')).toBe(2)
    })

    it('元の一覧は書き換えない', () => {
        filterFlowerTargets(targets, 'PAID')
        expect(targets[0].flowers).toHaveLength(2)
    })
})

describe('getFlowerTargetPaymentStatus', () => {
    it('全件入金済み／一部入金／未入金', () => {
        expect(getFlowerTargetPaymentStatus({ flowers: [flower(1, true), flower(1, true)] })).toBe('PAID')
        expect(getFlowerTargetPaymentStatus({ flowers: [flower(1, true), flower(1, false)] })).toBe('PARTIAL')
        expect(getFlowerTargetPaymentStatus({ flowers: [flower(1, false)] })).toBe('UNPAID')
        expect(getFlowerTargetPaymentStatus({ flowers: [] })).toBe('UNPAID')
    })
})

describe('selectPaidFlowersForReceipt', () => {
    it('領収書には入金済みの供花だけを載せ、入金済みが無い請求先は出さない', () => {
        const result = selectPaidFlowersForReceipt([
            { id: 'a', flowers: [flower(10000, true), flower(20000, false)] },
            { id: 'b', flowers: [flower(30000, false)] },
        ])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('a')
        expect(calcFlowerTargetTotal(result[0]).totalWithTax).toBe(11000)
    })
})
