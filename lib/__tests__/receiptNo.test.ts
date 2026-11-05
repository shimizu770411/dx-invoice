import { describe, it, expect } from 'vitest'
import { isValidReceiptNo, normalizeReceiptNo } from '../receiptNo'

describe('isValidReceiptNo', () => {
    it('空欄は正しい（任意入力）', () => {
        expect(isValidReceiptNo('')).toBe(true)
        expect(isValidReceiptNo('   ')).toBe(true)
        expect(isValidReceiptNo(undefined)).toBe(true)
        expect(isValidReceiptNo(null)).toBe(true)
    })

    it('半角数字ちょうど7桁は正しい（前後の空白は除く）', () => {
        expect(isValidReceiptNo('6253108')).toBe(true)
        expect(isValidReceiptNo('0000001')).toBe(true)
        expect(isValidReceiptNo(' 6253108 ')).toBe(true)
    })

    it('6桁・8桁・数字以外・全角数字は正しくない', () => {
        expect(isValidReceiptNo('625310')).toBe(false)
        expect(isValidReceiptNo('62531080')).toBe(false)
        expect(isValidReceiptNo('625310A')).toBe(false)
        expect(isValidReceiptNo('625-310')).toBe(false)
        expect(isValidReceiptNo('６２５３１０８')).toBe(false)
    })
})

describe('normalizeReceiptNo', () => {
    it('空欄は null、それ以外は前後の空白を除いた値', () => {
        expect(normalizeReceiptNo('')).toBeNull()
        expect(normalizeReceiptNo(undefined)).toBeNull()
        expect(normalizeReceiptNo(' 6253108 ')).toBe('6253108')
    })
})
