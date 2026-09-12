import { describe, it, expect } from 'vitest'
import { estimateItemFieldSchema, estimateFormSchema, DEFAULT_FORM_VALUES } from '../schemas/EstimateFormSchema'

const validItem = { qty: 1, description: '搬送費' }

// 見積フォームの全項目を埋めた最小の有効データ。
// 項目を増やしたときにここも追随させる必要があるため、初期値を土台にしている
const validBase = {
    ...DEFAULT_FORM_VALUES,
    docNo: '202607001',
    status: 'DRAFT',
    items: [validItem],
}

// -------------------------------------------------------
// estimateItemFieldSchema
// -------------------------------------------------------
describe('estimateItemFieldSchema', () => {
    it('有効なデータはパスする', () => {
        const result = estimateItemFieldSchema.safeParse(validItem)
        expect(result.success).toBe(true)
    })

    it('qty が文字列数値のとき coerce で変換する', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: '3', description: '' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.qty).toBe(3)
        }
    })

    it('qty が 0 はパスする（その商品を選んでいない状態を表す）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 0, description: '' })
        expect(result.success).toBe(true)
    })

    it('qty が負値だとエラー（min 0）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: -1, description: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.qty).toBeDefined()
        }
    })

    it('qty が 3001 だとエラー（max 3000）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 3001, description: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.qty).toBeDefined()
        }
    })

    it('qty が 3000 はパスする（max境界）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 3000, description: '' })
        expect(result.success).toBe(true)
    })

    it('description は空文字でもパスする', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 1, description: '' })
        expect(result.success).toBe(true)
    })
})

// -------------------------------------------------------
// estimateFormSchema
// -------------------------------------------------------
describe('estimateFormSchema', () => {
    it('有効なデータはパスする', () => {
        const result = estimateFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
    })

    it('items に複数の有効なアイテムがあるとパスする', () => {
        const result = estimateFormSchema.safeParse({
            ...validBase,
            items: [
                { qty: 1, description: '搬送費' },
                { qty: 2, description: '祭壇費' },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('items 内の qty が上限超過だとエラー', () => {
        const result = estimateFormSchema.safeParse({
            ...validBase,
            items: [{ qty: 3001, description: '' }],
        })
        expect(result.success).toBe(false)
    })

    it('任意フィールドはすべて空文字でもパスする', () => {
        const result = estimateFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.docNo).toBe('202607001')
            expect(result.data.status).toBe('DRAFT')
        }
    })

    it('見積番号は空欄でもパスする（自動採番のため）', () => {
        const result = estimateFormSchema.safeParse({ ...validBase, docNo: '' })
        expect(result.success).toBe(true)
    })

    it('見積番号が9桁の数字でないとエラー', () => {
        const result = estimateFormSchema.safeParse({ ...validBase, docNo: 'EST-001' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.docNo).toBeDefined()
        }
    })
})

// -------------------------------------------------------
// 【別料金】の金額項目（備考欄に表示する表示専用の項目）
// -------------------------------------------------------
describe('estimateFormSchema の【別料金】金額項目', () => {
    it('未入力（空文字）でもパスする', () => {
        const result = estimateFormSchema.safeParse({
            ...validBase,
            cremationFee: '',
            offeringFee: '',
            newspaperAdFee: '',
        })
        expect(result.success).toBe(true)
    })

    it('数値が入っていてもパスする', () => {
        const result = estimateFormSchema.safeParse({
            ...validBase,
            cremationFee: 25000,
            offeringFee: 900,
            newspaperAdFee: 1500,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.cremationFee).toBe(25000)
        }
    })

    it('初期値は未入力（空文字）', () => {
        expect(DEFAULT_FORM_VALUES.cremationFee).toBe('')
        expect(DEFAULT_FORM_VALUES.offeringFee).toBe('')
        expect(DEFAULT_FORM_VALUES.newspaperAdFee).toBe('')
    })
})
