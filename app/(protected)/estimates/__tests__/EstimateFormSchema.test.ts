import { describe, it, expect } from 'vitest'
import { estimateItemFieldSchema, estimateFormSchema } from '../schemas/EstimateFormSchema'

const validItem = { qty: 1, description: '搬送費' }

const validBase = {
    docNo: 'EST-001',
    status: 'DRAFT',
    cremationProcessType: '',
    altarPlaceType: '',
    altarPlaceOther: '',
    ceilingHeight: '',
    estimateStaff: '',
    ceremonyStaff: '',
    transportStaff: '',
    decorationStaff: '',
    returnStaff: '',
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

    it('qty が 0 だとエラー（min 1）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 0, description: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.qty).toBeDefined()
        }
    })

    it('qty が 1001 だとエラー（max 1000）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 1001, description: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.qty).toBeDefined()
        }
    })

    it('qty が 1000 はパスする（max境界）', () => {
        const result = estimateItemFieldSchema.safeParse({ qty: 1000, description: '' })
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

    it('items が空配列だとエラー（min 1）', () => {
        const result = estimateFormSchema.safeParse({ ...validBase, items: [] })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.items).toBeDefined()
        }
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

    it('items 内の qty が不正だとエラー', () => {
        const result = estimateFormSchema.safeParse({
            ...validBase,
            items: [{ qty: 0, description: '' }],
        })
        expect(result.success).toBe(false)
    })

    it('任意フィールドはすべて空文字でもパスする', () => {
        const result = estimateFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.docNo).toBe('EST-001')
            expect(result.data.status).toBe('DRAFT')
        }
    })
})
