import { describe, it, expect } from 'vitest'
import { buildMergedEstimateItems, buildVariantGroupRepresentative } from '@/lib/estimateItemMerge'

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

/**
 * 重箱のように種類のグループで選ぶ商品は、保存時に種類ごとの行へ分かれる。
 * 開き直すときは、その行から画面の1行（代表行）の単価と数量を組み立て直す。
 * 数量2で保存したものは数量2のまま戻し、単価×数量が保存時の金額と一致しなければならない。
 */
describe('種類のグループで選ぶ商品の代表行', () => {
    const row = (qty: number, general: number, member: number) => ({ qty, unitPriceGeneral: general, unitPriceMember: member })

    it('各行の数量がそろっていれば、単価は各種類の単価の合計、数量はその数量', () => {
        expect(buildVariantGroupRepresentative([row(2, 15200, 15200), row(2, 4170, 4170)])).toEqual({
            unitPriceGeneral: 19370,
            unitPriceMember: 19370,
            qty: 2,
        })
    })

    it('数量1で保存された既存の書類は、今までと同じ単価・数量1になる', () => {
        expect(buildVariantGroupRepresentative([row(1, 15200, 14000), row(1, 4170, 4000)])).toEqual({
            unitPriceGeneral: 19370,
            unitPriceMember: 18000,
            qty: 1,
        })
    })

    it('数量がそろっていない行は、金額が変わらないよう単価×数量の合計を単価にして数量1にする', () => {
        expect(buildVariantGroupRepresentative([row(2, 1000, 1000), row(3, 500, 500)])).toEqual({
            unitPriceGeneral: 3500,
            unitPriceMember: 3500,
            qty: 1,
        })
    })
})

/**
 * プラン切替では、画面に出ている明細（読み込み後に組み立て直した代表行を含む）をそのまま渡して作り直す。
 * 重箱の代表行は選んだ種類を groupSelections に持ち、保存行のような productVariantGroupId を持たない。
 * 以前は保存行の形しか見ていなかったため、重箱を選んでからプランを切り替えると、
 * 選んだ種類・数量・単価が警告なしに消えていた。
 */
describe('プラン切替時の、種類のグループで選ぶ商品', () => {
    const jubako = product({ id: 29, name: '重箱', hasVariantGroups: true, variants: [] })
    const onScreen = {
        productItemId: 29,
        description: '',
        unitPriceGeneral: 19370,
        unitPriceMember: 18000,
        qty: 3,
        amount: 0,
        sortNo: 0,
        groupSelections: JSON.stringify({ '7': ['101'], '8': ['205'] }),
        productItem: { id: 29, name: '重箱', hasVariantGroups: true },
    }

    it('画面で選んだ種類・数量・単価をそのまま引き継ぐ', () => {
        const [row] = merge(jubako, true, false, [onScreen])
        expect(row.groupSelections).toBe(onScreen.groupSelections)
        expect(row.qty).toBe(3)
        expect(row.unitPriceGeneral).toBe(19370)
        expect(row.unitPriceMember).toBe(18000)
    })

    it('商品の情報は切替後のプランのものに差し替える', () => {
        const [row] = merge(jubako, true, false, [onScreen])
        expect(row.productItem).toEqual(jubako)
    })

    it('種類を選んでいなければ、未選択の行のまま', () => {
        const [row] = merge(jubako, true, false, [])
        expect(row.qty).toBe(0)
        expect(row.groupSelections).toBeUndefined()
    })
})
