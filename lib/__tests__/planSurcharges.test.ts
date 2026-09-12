import { describe, it, expect } from 'vitest'
import { applySurchargeToPrice, canApplySurcharge } from '../planSurcharges'
import { resolveUnitPriceMember, resolveUnitPriceGeneral } from '../itemPricing'

describe('applySurchargeToPrice', () => {
    it('価格に増額を足す', () => {
        expect(applySurchargeToPrice(270000, 50000)).toBe(320000)
        expect(applySurchargeToPrice(270000, 81000)).toBe(351000)
    })

    it('増額が未選択なら価格のまま', () => {
        expect(applySurchargeToPrice(270000, null)).toBe(270000)
        expect(applySurchargeToPrice(270000, undefined)).toBe(270000)
        expect(applySurchargeToPrice(270000, 0)).toBe(270000)
    })
})

describe('canApplySurcharge', () => {
    it('親祭壇（セット親商品）だけ増額を選べる', () => {
        expect(canApplySurcharge({ isSetParent: true })).toBe(true)
    })

    it('親祭壇以外は選べない', () => {
        expect(canApplySurcharge({ isSetParent: false })).toBe(false)
        expect(canApplySurcharge(null)).toBe(false)
        expect(canApplySurcharge(undefined)).toBe(false)
    })
})

describe('増額の織り込み（一般価格・会員価格の両方）', () => {
    const variant = { priceGeneral: 350000, priceMember: 270000 }

    it('一般価格・会員価格の両方に同額が上乗せされる', () => {
        expect(resolveUnitPriceGeneral({}, variant, 50000)).toBe(400000)
        expect(resolveUnitPriceMember({}, variant, true, 50000)).toBe(320000)
    })

    it('増額の指定がなければ明細行が持っている増額を使う', () => {
        const item = { surchargeAmount: 81000 }
        expect(resolveUnitPriceGeneral(item, variant)).toBe(431000)
        expect(resolveUnitPriceMember(item, variant, true)).toBe(351000)
    })

    it('増額を明示的に null にすると解除される（明細行の値より優先）', () => {
        const item = { surchargeAmount: 81000 }
        expect(resolveUnitPriceGeneral(item, variant, null)).toBe(350000)
        expect(resolveUnitPriceMember(item, variant, true, null)).toBe(270000)
    })

    it('種類を選び直しても二重に上乗せされない（常にマスタ価格が基準）', () => {
        // 1回目: 27万コース + 5万円増
        expect(resolveUnitPriceGeneral({}, variant, 50000)).toBe(400000)
        expect(resolveUnitPriceMember({}, variant, true, 50000)).toBe(320000)
        // 2回目: 同じ増額のまま37万コースへ変更。マスタ価格が基準なので二重にならない
        const item = { surchargeAmount: 50000 }
        const next = { priceGeneral: 450000, priceMember: 370000 }
        expect(resolveUnitPriceGeneral(item, next, 50000)).toBe(500000)
        expect(resolveUnitPriceMember(item, next, true, 50000)).toBe(420000)
    })

    it('増額なしなら商品マスタの価格をそのまま返す', () => {
        expect(resolveUnitPriceGeneral({}, variant)).toBe(350000)
        expect(resolveUnitPriceMember({}, variant, true)).toBe(270000)
    })
})
