import { describe, it, expect } from 'vitest'
import { caseFormSchema, customerMembershipSchema } from '../schemas/CaseFormSchema'

// バリデーション成功時に使う最小限の有効データ
const validBase = {
    receptionAt: '2026-03-11',
    deceasedName: '山田太郎',
    age: 80,
    chiefMournerName: '山田花子',
    memberships: [],
}

// -------------------------------------------------------
// caseFormSchema — 必須フィールド
// -------------------------------------------------------
describe('caseFormSchema — 必須フィールド', () => {
    it('最小限の有効データはパスする', () => {
        const result = caseFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
    })

    it('receptionAt が空だとエラー', () => {
        const result = caseFormSchema.safeParse({ ...validBase, receptionAt: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            const fields = result.error.flatten().fieldErrors
            expect(fields.receptionAt).toBeDefined()
        }
    })

    it('deceasedName が空だとエラー', () => {
        const result = caseFormSchema.safeParse({ ...validBase, deceasedName: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.deceasedName).toBeDefined()
        }
    })

    it('chiefMournerName は任意（空でも登録できる）', () => {
        const result = caseFormSchema.safeParse({ ...validBase, chiefMournerName: '' })
        expect(result.success).toBe(true)
    })

    it('chiefMournerName が未登録(null)の案件を開いても、文字列 "null" にならず空のまま', () => {
        const result = caseFormSchema.safeParse({ ...validBase, chiefMournerName: null })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.chiefMournerName).toBe('')
        }
    })

    it('age が 0 だとエラー（min 1）', () => {
        const result = caseFormSchema.safeParse({ ...validBase, age: 0 })
        expect(result.success).toBe(false)
    })

    it('age が空文字のときエラー', () => {
        const result = caseFormSchema.safeParse({ ...validBase, age: '' })
        expect(result.success).toBe(false)
    })

    it('age が数値文字列のとき数値に変換してパスする', () => {
        const result = caseFormSchema.safeParse({ ...validBase, age: '75' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.age).toBe(75)
        }
    })
})

// -------------------------------------------------------
// caseFormSchema — 電話番号バリデーション
// -------------------------------------------------------
describe('caseFormSchema — 電話番号', () => {
    const cases = [
        { tel: '09012345678', valid: true },
        { tel: '090-1234-5678', valid: true },
        { tel: '03-1234-5678', valid: true },
        { tel: '0120-123-456', valid: true },
        { tel: '', valid: true }, // optional なので空も OK
        { tel: undefined, valid: true }, // optional
        { tel: 'abc', valid: false },
        { tel: '0-1234-5678', valid: false }, // 先頭が1桁（\d{2,4} に不一致）
        { tel: '090-1-5678', valid: false }, // 中間が1桁（\d{2,4} に不一致）
    ]

    cases.forEach(({ tel, valid }) => {
        it(`chiefMournerTel: "${tel}" → ${valid ? 'パス' : 'エラー'}`, () => {
            const result = caseFormSchema.safeParse({ ...validBase, chiefMournerTel: tel })
            expect(result.success).toBe(valid)
        })
    })

    it('全角数字を半角に正規化して検証する（０９０-１２３４-５６７８）', () => {
        const result = caseFormSchema.safeParse({
            ...validBase,
            chiefMournerTel: '０９０-１２３４-５６７８',
        })
        expect(result.success).toBe(true)
    })

    it('全角ハイフン（ー）を半角に正規化して検証する', () => {
        const result = caseFormSchema.safeParse({
            ...validBase,
            chiefMournerTel: '090ー1234ー5678',
        })
        expect(result.success).toBe(true)
    })

    it('payerTel も同様に検証する', () => {
        const result = caseFormSchema.safeParse({ ...validBase, payerTel: 'invalid' })
        expect(result.success).toBe(false)
    })
})

// -------------------------------------------------------
// caseFormSchema — デフォルト値
// -------------------------------------------------------
describe('caseFormSchema — デフォルト値', () => {
    it('sameAsChiefMourner を省略すると false になる', () => {
        const result = caseFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.sameAsChiefMourner).toBe(false)
        }
    })

    it('chiefMournerPostalCode を省略すると空文字になる', () => {
        const result = caseFormSchema.safeParse(validBase)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.chiefMournerPostalCode).toBe('')
        }
    })
})

// -------------------------------------------------------
// customerMembershipSchema
// -------------------------------------------------------
describe('customerMembershipSchema', () => {
    it('最小限の有効データはパスする', () => {
        const result = customerMembershipSchema.safeParse({ rowNo: 1 })
        expect(result.success).toBe(true)
    })

    it('maturityAmount のカンマ区切り文字列を数値に変換する', () => {
        const result = customerMembershipSchema.safeParse({
            rowNo: 1,
            maturityAmount: '1,200,000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.maturityAmount).toBe(1200000)
        }
    })

    it('paymentAmount のカンマ区切り文字列を数値に変換する', () => {
        const result = customerMembershipSchema.safeParse({
            rowNo: 1,
            paymentAmount: '50,000',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.paymentAmount).toBe(50000)
        }
    })

    it('courseUnits が文字列数値のとき coerce で変換する', () => {
        const result = customerMembershipSchema.safeParse({
            rowNo: 1,
            courseUnits: '12',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.courseUnits).toBe(12)
        }
    })
})
