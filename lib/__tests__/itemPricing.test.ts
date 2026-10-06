import { describe, it, expect } from 'vitest'
import { allowedServiceFlags, resolveVariantChange } from '../itemPricing'

// 種類を選び直したときの単価と、サービス品・満期サービスの印。
// 印は商品マスタで許可された商品にだけ効く。マスタの設定を後から「不可」に戻すと、
// 明細に残った印を画面から外す手段が無くなるため、許可されていない印は無視する。
describe('resolveVariantChange', () => {
    const variant = { priceGeneral: 90000, priceMember: 80000 }
    const plainProduct = { serviceableScope: 'NONE' as const, isMaturityServiceable: false }

    it('印が無ければ商品マスタの価格を取り込む', () => {
        const result = resolveVariantChange({ productItem: plainProduct }, variant, true, {})
        expect(result).toMatchObject({ unitPriceGeneral: 90000, unitPriceMember: 80000 })
    })

    it('満期サービスにできない商品では、明細に残った満期サービスの印を外して会員価格を取り込む', () => {
        const result = resolveVariantChange({ productItem: plainProduct }, variant, true, { isMaturityService: true })
        expect(result).toMatchObject({ unitPriceMember: 80000, isMaturityService: false })
    })

    it('サービス品にできない商品では、明細に残ったサービス品の印を外して会員価格を取り込む', () => {
        const result = resolveVariantChange({ productItem: plainProduct }, variant, true, { isService: true })
        expect(result).toMatchObject({ unitPriceMember: 80000, isService: false })
    })

    it('満期サービスにできる商品なら、印を保って会員単価を0円にする', () => {
        const product = { ...plainProduct, isMaturityServiceable: true }
        const result = resolveVariantChange({ productItem: product }, variant, true, { isMaturityService: true })
        expect(result).toMatchObject({ unitPriceMember: 0, isMaturityService: true })
    })

    it('サービス品にできる商品なら、印を保って会員単価を0円にする', () => {
        const product = { ...plainProduct, serviceableScope: 'BOTH' as const }
        const result = resolveVariantChange({ productItem: product }, variant, true, { isService: true })
        expect(result).toMatchObject({ unitPriceMember: 0, isService: true })
    })
})

describe('allowedServiceFlags', () => {
    it('商品マスタで許可されていない印は外す', () => {
        expect(
            allowedServiceFlags(
                { serviceableScope: 'NONE', isMaturityServiceable: false },
                { isService: true, isMaturityService: true }
            )
        ).toEqual({ isService: false, isMaturityService: false })
    })

    it('許可されている印はそのまま', () => {
        expect(
            allowedServiceFlags(
                { serviceableScope: 'MEMBER_ONLY', isMaturityServiceable: true },
                { isService: true, isMaturityService: true }
            )
        ).toEqual({ isService: true, isMaturityService: true })
    })
})
