import { describe, it, expect } from 'vitest'
import { toFreeItemDisplay, shouldShowFreeItemUnitPrice, isFreeItemQtyHidden } from '@/lib/pdfFreeItemDisplay'

// 下部の自由入力行の単価・数量は、自社情報管理の設定で全行まとめて出し分ける。
const freeRow = { isFreeItem: true, isFixedRow: false }
const linkedRow = { isFreeItem: true, isFixedRow: true, isLinkedFreeRow: true } // 控室管理費の追加行
const fixedRow = { isFreeItem: true, isFixedRow: true } // 満期サービス等
const productRow = {}
const show = { showUnitPrice: true, showQty: true }
const hide = { showUnitPrice: false, showQty: false }

describe('toFreeItemDisplay', () => {
    it('自社情報が無い・設定が未保存なら、これまでどおり表示する', () => {
        expect(toFreeItemDisplay(null)).toEqual(show)
        expect(toFreeItemDisplay({})).toEqual(show)
    })

    it('「表示しない」を選んだ項目だけ止める', () => {
        expect(toFreeItemDisplay({ pdfShowFreeItemUnitPrice: false, pdfShowFreeItemQty: true })).toEqual({
            showUnitPrice: false,
            showQty: true,
        })
    })
})

describe('単価の表示', () => {
    it('設定が「表示する」なら、下部の自由入力行に単価を出す', () => {
        expect(shouldShowFreeItemUnitPrice(freeRow, show)).toBe(true)
    })

    it('設定が「表示しない」なら、下部の自由入力行に単価を出さない', () => {
        expect(shouldShowFreeItemUnitPrice(freeRow, hide)).toBe(false)
    })

    it('控室管理費の追加行・固定行・商品の行には、設定に関わらず単価を出さない', () => {
        for (const row of [linkedRow, fixedRow, productRow]) {
            expect(shouldShowFreeItemUnitPrice(row, show)).toBe(false)
        }
    })
})

describe('数量の表示', () => {
    it('設定が「表示しない」なら、下部の自由入力行の数量を止める', () => {
        expect(isFreeItemQtyHidden(freeRow, hide)).toBe(true)
    })

    it('設定が「表示する」なら止めない', () => {
        expect(isFreeItemQtyHidden(freeRow, show)).toBe(false)
    })

    it('控室管理費の追加行・固定行・商品の行は、設定の影響を受けない', () => {
        for (const row of [linkedRow, fixedRow, productRow]) {
            expect(isFreeItemQtyHidden(row, hide)).toBe(false)
        }
    })
})
