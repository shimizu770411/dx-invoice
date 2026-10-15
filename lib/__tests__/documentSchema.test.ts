import { describe, it, expect } from 'vitest'
import { documentFreeItemFieldSchema } from '@/lib/documentSchema'
import { MATURITY_SERVICE_NAME } from '@/lib/documentFixedRows'

// フリー行の素材。テストで必要な属性だけを指定し、残りは既定値で埋める
const freeItem = (overrides: Record<string, any> = {}) => ({
    parentProductItemId: null,
    productItemName: '値引',
    description: '',
    unitPriceGeneral: 0,
    unitPriceMember: 0,
    qty: 1,
    ...overrides,
})

describe('フリー行の金額の入力チェック', () => {
    it('自由入力行はマイナスの金額を入力できる', () => {
        const result = documentFreeItemFieldSchema.safeParse(
            freeItem({ unitPriceGeneral: -30000, unitPriceMember: -20000 })
        )
        expect(result.success).toBe(true)
    })

    it('商品に紐付く追加行はマイナスの金額を入力できない', () => {
        const result = documentFreeItemFieldSchema.safeParse(
            freeItem({ parentProductItemId: '1', unitPriceGeneral: -30000, unitPriceMember: -20000 })
        )
        expect(result.success).toBe(false)
        expect(result.error?.issues.map((i) => i.path[0])).toEqual(['unitPriceGeneral', 'unitPriceMember'])
    })

    it('満期サービスはプラスの金額を入力できない', () => {
        const result = documentFreeItemFieldSchema.safeParse(
            freeItem({ productItemName: MATURITY_SERVICE_NAME, unitPriceGeneral: 10000 })
        )
        expect(result.success).toBe(false)
    })
})
