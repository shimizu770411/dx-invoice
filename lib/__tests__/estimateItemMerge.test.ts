import { describe, it, expect } from 'vitest'
import { buildMergedEstimateItems } from '@/lib/estimateItemMerge'

/**
 * 見積を開いたとき、担当者が外した初期セット品のチェックが復活してしまう不具合の再発防止。
 *
 * 数量0の明細は保存されない（保存時に数量1以上の行だけ送る）ため、読み込み時に
 * 「保存済み明細が無い＝未選択」と「担当者がチェックを外した」を区別できない。
 * そこで自動チェックはプラン切替時（isPlanChange=true）だけに限定している。
 * 読み込み時（isPlanChange=false）にも自動チェックすると、外したはずのセット商品が
 * 開くたびに復活し、合計金額も勝手に増える。
 */

const variant = (id: number, isDefaultSet = true) => ({
    id,
    name: '基本型',
    priceGeneral: 10000,
    priceMember: 8000,
    isDefaultSet,
})

const product = (overrides: Record<string, any> = {}) =>
    ({
        id: 40,
        name: '御霊前セット',
        variants: [variant(152)],
        setableScope: 'NONE',
        ...overrides,
    }) as any

const merge = (p: any, isPlanChange: boolean, isMember = false, existing: any[] = []) =>
    buildMergedEstimateItems([p], existing as any, isMember, isPlanChange)

describe('保存済み明細が無い商品の自動チェック', () => {
    describe('プラン内で唯一のセット親商品に紐づく子商品', () => {
        const p = product({ isSoleSetParentChild: true })

        it('読み込み時は自動チェックしない', () => {
            // ここが今回の修正点。外したチェックが復活しないこと
            expect(merge(p, false)[0].qty).toBe(0)
        })

        it('プラン切替時は自動チェックする', () => {
            expect(merge(p, true)[0].qty).toBe(1)
        })
    })

    describe('プラン内で唯一のセット親商品', () => {
        const p = product({ id: 1, name: '式場祭壇', isSetParent: true, isSoleSetParent: true })

        it('読み込み時は自動チェックしない', () => {
            expect(merge(p, false)[0].qty).toBe(0)
        })

        it('プラン切替時は自動チェックする', () => {
            expect(merge(p, true)[0].qty).toBe(1)
        })
    })

    describe('プラン設定で疑似セット子化された一般商品', () => {
        const p = product({ id: 15, name: '脱臭剤', isPlanForcedSet: true, setableScope: 'MEMBER_ONLY' })

        it('読み込み時は、会員であっても自動チェックしない', () => {
            expect(merge(p, false, true)[0].qty).toBe(0)
        })

        it('プラン切替時、会員なら自動チェックする', () => {
            expect(merge(p, true, true)[0].qty).toBe(1)
        })

        it('プラン切替時でも、一般客なら適用範囲外なので自動チェックしない', () => {
            // setableScope=MEMBER_ONLY は会員のときだけ効く
            expect(merge(p, true, false)[0].qty).toBe(0)
        })
    })

    it('セット扱いでない通常商品は、プラン切替時も自動チェックしない', () => {
        const p = product({ id: 26, name: '控室管理費' })
        expect(merge(p, true)[0].qty).toBe(0)
        expect(merge(p, false)[0].qty).toBe(0)
    })

    it('自動チェックしない場合も、初期種類と単価は商品マスタから引く', () => {
        const row = merge(product({ isSoleSetParentChild: true }), false)[0]
        expect(String(row.productVariantId)).toBe('152')
        expect(row.unitPriceGeneral).toBe(10000)
        expect(row.unitPriceMember).toBe(8000)
    })
})

describe('保存済み明細がある商品', () => {
    const existing = (overrides: Record<string, any> = {}) => [
        {
            productItemId: 40,
            productVariantId: 152,
            qty: 1,
            unitPriceGeneral: 9000,
            unitPriceMember: 7000,
            productItem: { id: 40, setableScope: 'NONE', variants: [variant(152)] },
            ...overrides,
        },
    ]

    it('読み込み時は保存済みの単価を商品マスタの現在価格で上書きしない', () => {
        // 価格改定後に旧見積を開いただけで金額が変わってはいけない
        const row = merge(product({ isSoleSetParentChild: true }), false, false, existing())[0]
        expect(row.unitPriceGeneral).toBe(9000)
        expect(row.unitPriceMember).toBe(7000)
    })

    it('読み込み時は保存済みの数量をそのまま保つ', () => {
        const row = merge(product({ isSoleSetParentChild: true }), false, false, existing({ qty: 3 }))[0]
        expect(row.qty).toBe(3)
    })
})
