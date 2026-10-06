import { describe, it, expect } from 'vitest'
import { expandEachModeItems, expandVariantGroupItems, buildDocumentFreeItems, isFreeItemToSave } from '@/lib/documentUtils'

/**
 * 複数選択商品・グループ商品は、保存時に種類ごとの明細行へ展開される。
 * 展開前の代表行が持っている「0円扱いの控え」は別の種類のものなので、
 * 展開後の各行では必ず作り直さなければならない。
 * 引き継いでしまうと、代表行がセット種類だった場合に全種類が 0 円になる。
 */

const variant = (id: number, name: string, isDefaultSet: boolean) => ({
    id,
    name,
    priceGeneral: 10000,
    priceMember: 8000,
    isDefaultSet,
})

describe('複数選択商品の展開', () => {
    // 種類Aは初期セット品（セット扱いで0円）、種類Bは通常（満額）
    const buildItem = (overrides: Record<string, any> = {}) => ({
        qty: 1,
        amount: 0,
        unitPriceGeneral: 10000,
        unitPriceMember: 8000,
        noChargeScope: null as string | null,
        noChargeReason: null as string | null,
        multiSelectVariantIds: JSON.stringify(['1', '2']),
        productItem: {
            isMultiSelect: true,
            multiSelectMerge: false,
            isSetChild: true,
            setableScope: 'BOTH',
            variants: [variant(1, 'A', true), variant(2, 'B', false)],
        },
        ...overrides,
    })

    it('展開後の各行は、自分が持つ種類で 0 円扱いかを判定する', () => {
        const rows = expandEachModeItems([buildItem()], false)
        expect(rows).toHaveLength(2)
        expect(rows[0].noChargeScope).toBe('BOTH')
        expect(rows[0].amount).toBe(0)
        expect(rows[1].noChargeScope).toBe('NONE')
        expect(rows[1].amount).toBe(10000)
    })

    it('代表行の控えを展開後の行へ引き継がない', () => {
        // 代表行に「会員・一般とも0円」の控えが付いていても、種類Bは満額のまま
        const rows = expandEachModeItems(
            [buildItem({ noChargeScope: 'BOTH', noChargeReason: 'SET' })],
            false
        )
        expect(rows[1].noChargeScope).toBe('NONE')
        expect(rows[1].amount).toBe(10000)
    })
})

describe('グループ商品の展開', () => {
    const buildItem = (overrides: Record<string, any> = {}) => ({
        qty: 1,
        amount: 0,
        unitPriceGeneral: 10000,
        unitPriceMember: 8000,
        noChargeScope: null as string | null,
        noChargeReason: null as string | null,
        groupSelections: JSON.stringify({ '10': ['1', '2'] }),
        productItem: {
            hasVariantGroups: true,
            isSetChild: true,
            setableScope: 'BOTH',
            variantGroups: [
                {
                    id: 10,
                    selectionType: 'SINGLE',
                    variants: [variant(1, 'A', true), variant(2, 'B', false)],
                },
            ],
        },
        ...overrides,
    })

    it('展開後の各行は、自分が持つ種類で 0 円扱いかを判定する', () => {
        const rows = expandVariantGroupItems([buildItem()], false)
        expect(rows).toHaveLength(2)
        expect(rows[0].noChargeScope).toBe('BOTH')
        expect(rows[0].amount).toBe(0)
        expect(rows[1].noChargeScope).toBe('NONE')
        expect(rows[1].amount).toBe(10000)
    })

    it('代表行の控えを展開後の行へ引き継がない', () => {
        const rows = expandVariantGroupItems(
            [buildItem({ noChargeScope: 'BOTH', noChargeReason: 'SET' })],
            false
        )
        expect(rows[1].noChargeScope).toBe('NONE')
        expect(rows[1].amount).toBe(10000)
    })
})
describe('フリー行追加がONの商品の親リンク行', () => {
    // 控室管理費のように「フリー行追加」が ON の商品。
    // 画面はこの親リンク行が既にある場合だけ商品の直下にフリー行を描画し、
    // チェックを入れる操作では行を作らない。そのため読み込み時点で必ず用意しておく必要がある。
    type FreeRow = {
        parentProductItemId?: string | null
        productItemName: string
        description?: string
        unitPriceGeneral: number
        unitPriceMember: number
        qty: number
        amount: number
        sortNo?: number
    }
    const freeRowProduct = { id: 26, canAddFreeRow: true }
    const plainProduct = { id: 99, canAddFreeRow: false }
    const build = (loaded: FreeRow[], qty: number, product: any, fixedRowNames: string[] = []) =>
        buildDocumentFreeItems<FreeRow>(loaded, [{ qty, productItem: product }], fixedRowNames)
    const parentIdsOf = (rows: FreeRow[]) =>
        rows.filter((r) => r.parentProductItemId).map((r) => String(r.parentProductItemId))

    it('チェックが入っていない商品にも親リンク行を用意する', () => {
        // 数量0（未チェック）で読み込んでも行が作られないと、後からチェックしてもフリー行を出せない
        const rows = build([], 0, freeRowProduct)
        expect(parentIdsOf(rows)).toEqual(['26'])
    })

    it('チェック済みの商品にも親リンク行を用意する', () => {
        const rows = build([], 1, freeRowProduct)
        expect(parentIdsOf(rows)).toEqual(['26'])
    })

    it('フリー行追加がOFFの商品には親リンク行を作らない', () => {
        const rows = build([], 1, plainProduct)
        expect(parentIdsOf(rows)).toEqual([])
    })

    it('保存済みの親リンク行がある場合は作り直さず、入力内容を保つ', () => {
        const saved = {
            parentProductItemId: '26',
            productItemName: '延長分',
            description: '',
            unitPriceGeneral: 5000,
            unitPriceMember: 3000,
            qty: 2,
            amount: 10000,
        }
        const rows = build([saved], 0, freeRowProduct)
        const linked = rows.filter((r) => r.parentProductItemId)
        expect(linked).toHaveLength(1)
        expect(linked[0].productItemName).toBe('延長分')
        expect(linked[0].qty).toBe(2)
    })

    it('自動生成した親リンク行は空で、保存対象にならない', () => {
        // 保存側は「品目名が入っていて数量1以上」の行だけを送るため、空行はDBに残らない
        const rows = build([], 0, freeRowProduct)
        const linked = rows.filter((r) => r.parentProductItemId)
        expect(linked).toHaveLength(1)
        expect(linked[0].productItemName).toBe('')
        expect(linked[0].qty).toBe(0)
        expect(linked[0].unitPriceGeneral).toBe(0)
    })

    it('親なしのフリー行は5行に揃え、固定行を末尾に置く（親リンク行はその後ろ）', () => {
        const rows = build([], 0, freeRowProduct, ['満期サービス'])
        expect(rows).toHaveLength(7)
        expect(rows[5].productItemName).toBe('満期サービス')
        expect(String(rows[6].parentProductItemId)).toBe('26')
    })
})

describe('保存する自由入力行', () => {
    // 控室管理費の追加行などは、品目名を入れずに数量と金額だけ入れる運用がある。
    // 品目名が空というだけで捨てると、入力した金額が警告も無く消える。
    const row = (overrides: Record<string, any> = {}) => ({
        productItemName: '',
        unitPriceGeneral: 0,
        unitPriceMember: 0,
        qty: 0,
        ...overrides,
    })

    it('品目名が空でも、数量と一般価格があれば保存する', () => {
        expect(isFreeItemToSave(row({ qty: 1, unitPriceGeneral: 5000 }))).toBe(true)
    })

    it('品目名が空でも、数量と会員価格があれば保存する', () => {
        expect(isFreeItemToSave(row({ qty: 1, unitPriceMember: 3000 }))).toBe(true)
    })

    it('品目名があれば、金額が0でも数量があれば保存する（満期サービス等の固定行を含む）', () => {
        expect(isFreeItemToSave(row({ productItemName: '満期サービス', qty: 1 }))).toBe(true)
    })

    it('品目名も金額も無ければ、数量があっても保存しない', () => {
        expect(isFreeItemToSave(row({ qty: 1 }))).toBe(false)
    })

    it('数量が0なら保存しない', () => {
        expect(isFreeItemToSave(row({ productItemName: '控室延長', unitPriceGeneral: 5000 }))).toBe(false)
    })
})
