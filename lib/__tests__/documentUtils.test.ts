import { describe, it, expect } from 'vitest'
import { expandEachModeItems, expandVariantGroupItems } from '@/lib/documentUtils'

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
