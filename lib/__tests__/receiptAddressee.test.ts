import { describe, it, expect } from 'vitest'
import {
    defaultReceiptAddressee,
    isValidReceiptAddressee,
    normalizeReceiptAddressee,
    RECEIPT_ADDRESSEE_MAX_LENGTH,
    resolveReceiptAddressee,
} from '../receiptAddressee'

describe('領収書の宛名', () => {
    it('初期値は支払者名、それが空なら喪主名', () => {
        expect(defaultReceiptAddressee({ payerName: '支払　花子', chiefMournerName: '喪主　太郎' })).toBe('支払　花子')
        expect(defaultReceiptAddressee({ payerName: '', chiefMournerName: '喪主　太郎' })).toBe('喪主　太郎')
        expect(defaultReceiptAddressee({ payerName: '  ', chiefMournerName: '喪主　太郎' })).toBe('喪主　太郎')
        expect(defaultReceiptAddressee({ payerName: null, chiefMournerName: null })).toBe('')
        expect(defaultReceiptAddressee(undefined)).toBe('')
    })

    it('入金登録で入れた宛名があればそれを出し、無ければ初期値と同じ決め方', () => {
        const customer = { payerName: '支払　花子', chiefMournerName: '喪主　太郎' }
        expect(resolveReceiptAddressee('株式会社　沖縄', customer)).toBe('株式会社　沖縄')
        expect(resolveReceiptAddressee(null, customer)).toBe('支払　花子')
        expect(resolveReceiptAddressee('   ', customer)).toBe('支払　花子')
    })

    it('保存する値は前後の空白を除き、空欄は null', () => {
        expect(normalizeReceiptAddressee('  山田　太郎 ')).toBe('山田　太郎')
        expect(normalizeReceiptAddressee('')).toBeNull()
        expect(normalizeReceiptAddressee(undefined)).toBeNull()
    })

    it('上限文字数を超える宛名は断る', () => {
        expect(isValidReceiptAddressee('')).toBe(true)
        expect(isValidReceiptAddressee('あ'.repeat(RECEIPT_ADDRESSEE_MAX_LENGTH))).toBe(true)
        expect(isValidReceiptAddressee('あ'.repeat(RECEIPT_ADDRESSEE_MAX_LENGTH + 1))).toBe(false)
    })
})
