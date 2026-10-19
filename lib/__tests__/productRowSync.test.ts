import { describe, it, expect } from 'vitest'
import { planProductRowSync, splitRemovals, type ExistingRow } from '../productRowSync'

// 霊柩車の構成（固定料金の「車種」行＋距離の「10㎞毎に」行）
const existing: ExistingRow[] = [
    { id: '69', variants: [{ id: '264' }, { id: '265' }] },
    { id: '70', variants: [{ id: '269' }] },
]

const sentRow = (id: string | undefined, label: string, variants: { id?: string; label: string; unitPrice: number }[]) => ({
    id,
    label,
    calcType: id === '69' ? 'FIXED' : 'UNIT_PRICE_X_QTY',
    defaultQty: 1,
    hasReturn: false,
    useForVariantLabel: false,
    useForDescriptionLabel: false,
    variants: variants.map((v) => ({ ...v, abbreviatedName: null, unitLabel: null, imageUrl: null, isDefault: false })),
})

const unchangedPayload = () => [
    sentRow('69', '車種', [
        { id: '264', label: 'クラウン', unitPrice: 36000 },
        { id: '265', label: 'アルファード', unitPrice: 36000 },
    ]),
    sentRow('70', '10㎞毎に', [{ id: '269', label: '10㎞毎に', unitPrice: 6000 }]),
]

const planOf = (sent: unknown) => {
    const result = planProductRowSync(existing, sent)
    if (!result.ok) throw new Error(result.message)
    return result.plan
}

describe('planProductRowSync', () => {
    it('変更せずに保存したときは、既存の行・種類をすべて同じIDのまま更新し、何も外さない', () => {
        const plan = planOf(unchangedPayload())
        expect(plan.rows.map((r) => r.id)).toEqual(['69', '70'])
        expect(plan.rows.flatMap((r) => r.variants.map((v) => v.id))).toEqual(['264', '265', '269'])
        expect(plan.removedRowIds).toEqual([])
        expect(plan.removedVariantIds).toEqual([])
    })

    it('追加した行・種類はIDなし（新規作成）になり、既存のIDはそのまま', () => {
        const sent = unchangedPayload()
        sent[0].variants.push({ label: 'セレナ', unitPrice: 36000, abbreviatedName: null, unitLabel: null, imageUrl: null, isDefault: false } as any)
        sent.push(sentRow(undefined, '深夜割増', [{ label: '標準', unitPrice: 5000 }]))
        const plan = planOf(sent)
        expect(plan.rows.map((r) => r.id)).toEqual(['69', '70', null])
        expect(plan.rows[0].variants.map((v) => v.id)).toEqual(['264', '265', null])
        expect(plan.rows[2].variants.map((v) => v.id)).toEqual([null])
    })

    it('並べ替えた種類は、IDを保ったまま画面の並び順が表示順になる', () => {
        const sent = unchangedPayload()
        sent[0].variants.reverse()
        const plan = planOf(sent)
        expect(plan.rows[0].variants.map((v) => [v.id, v.sortNo])).toEqual([
            ['265', 0],
            ['264', 1],
        ])
    })

    it('送られなかった行・種類は「外すもの」になる。外した行の種類は行と一緒に扱う', () => {
        const sent = unchangedPayload()
        sent[0].variants = sent[0].variants.filter((v) => v.id !== '265')
        const plan = planOf([sent[0]])
        expect(plan.removedRowIds).toEqual(['70'])
        expect(plan.removedVariantIds).toEqual(['265'])
    })

    it('複数行構成をやめた（行を1つも送らない）ときは、全行が外すものになる', () => {
        const plan = planOf([])
        expect(plan.rows).toEqual([])
        expect(plan.removedRowIds).toEqual(['69', '70'])
    })

    it('入力値は従来どおりに整える（計算方式の既定・空文字の略称はなし・数値でない単価は0）', () => {
        const plan = planOf([
            { id: '69', label: '車種', calcType: 'X', defaultQty: 'abc', variants: [{ id: '264', label: 'クラウン', abbreviatedName: '', unitPrice: 'x' }] },
        ])
        expect(plan.rows[0].data).toMatchObject({ calcType: 'UNIT_PRICE_X_QTY', defaultQty: 1, isActive: true })
        expect(plan.rows[0].variants[0].data).toMatchObject({ abbreviatedName: null, unitPrice: 0, isActive: true })
    })

    it('この商品の行でないIDは保存させない', () => {
        const result = planProductRowSync(existing, [sentRow('999', '車種', [])])
        expect(result.ok).toBe(false)
    })

    it('別の行の種類のIDは保存させない（行をまたいだ付け替えをしない）', () => {
        const result = planProductRowSync(existing, [sentRow('70', '10㎞毎に', [{ id: '264', label: 'クラウン', unitPrice: 36000 }])])
        expect(result.ok).toBe(false)
    })

    it('新しい行に既存の種類のIDが付いていたら保存させない', () => {
        const result = planProductRowSync(existing, [sentRow(undefined, '新しい行', [{ id: '269', label: '10㎞毎に', unitPrice: 6000 }])])
        expect(result.ok).toBe(false)
    })

    it('同じ行のIDが2回送られたら保存させない', () => {
        const result = planProductRowSync(existing, [sentRow('69', '車種', []), sentRow('69', '車種', [])])
        expect(result.ok).toBe(false)
    })
})

describe('splitRemovals', () => {
    it('見積・請求書で使われている行・種類は無効化、使われていないものは削除に分ける', () => {
        const sent = unchangedPayload()
        sent[0].variants = sent[0].variants.filter((v) => v.id !== '265')
        const plan = planOf([sent[0]])
        expect(splitRemovals(plan, existing, { rowIds: new Set(), variantIds: new Set(['265']) })).toEqual({
            deactivateRowIds: [],
            deleteRowIds: ['70'],
            deactivateVariantIds: ['265'],
            deleteVariantIds: [],
        })
    })

    it('行そのものの参照が無くても、配下の種類が使われていれば行は無効化にとどめる', () => {
        const plan = planOf([])
        expect(splitRemovals(plan, existing, { rowIds: new Set(), variantIds: new Set(['269']) })).toEqual({
            deactivateRowIds: ['70'],
            deleteRowIds: ['69'],
            deactivateVariantIds: [],
            deleteVariantIds: [],
        })
    })
})
