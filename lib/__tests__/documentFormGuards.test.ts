import { describe, it, expect } from 'vitest'
import { trimStaleFormRows, validationErrorTitle } from '@/lib/documentFormGuards'

describe('画面の明細より後ろに残った行を取り除く', () => {
    const run = (values: Record<string, unknown[]>, counts: { items: number; freeItems: number }) => {
        const form: Record<string, unknown[]> = { ...values }
        trimStaleFormRows(
            (name) => form[name],
            (name, value) => {
                form[name] = value
            },
            counts
        )
        return form
    }

    it('プラン切替で明細が減ったあとに残った、中身の無い行を取り除く', () => {
        const items = [{ qty: 1, description: '' }, { qty: 2, description: '' }, undefined, {}]
        expect(run({ items, freeItems: [] }, { items: 2, freeItems: 0 }).items).toEqual(items.slice(0, 2))
    })

    it('数がそろっていれば何もしない', () => {
        const items = [{ qty: 1, description: '' }]
        const freeItems = [{ qty: 0 }]
        const form = run({ items, freeItems }, { items: 1, freeItems: 1 })
        expect(form.items).toBe(items)
        expect(form.freeItems).toBe(freeItems)
    })
})

describe('保存時の入力チェックで止まったときの通知', () => {
    it('明細行の中の項目のエラーでも、無言にせず通知する', () => {
        const errors = { items: [undefined, { qty: { message: 'Expected number, received nan', type: 'invalid_type' } }] }
        expect(validationErrorTitle(errors)).toContain('保存できませんでした')
    })

    it('日本語で書いた文言があれば、それをそのまま出す', () => {
        expect(validationErrorTitle({ items: [{ qty: { message: '数量オーバー' } }] })).toBe('数量オーバー')
        expect(validationErrorTitle({ freeItems: [undefined, { unitPriceGeneral: { message: '満期サービスは0以下の金額を入力してください' } }] })).toBe(
            '満期サービスは0以下の金額を入力してください'
        )
    })

    it('明細全体のエラーや、ほかの項目のエラーも出す', () => {
        expect(validationErrorTitle({ items: { root: { message: '品目を選んでください' } } })).toBe('品目を選んでください')
        expect(validationErrorTitle({ docNo: { message: '見積番号が重複しています' } })).toBe('見積番号が重複しています')
    })
})
