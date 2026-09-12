import { describe, it, expect } from 'vitest'
import {
    buildSeparateFeesText,
    parseSeparateFeesBlock,
    buildInvoiceFeeLines,
    calcInvoicePaymentTotal,
    buildBankTransferText,
} from '../separateFees'

// 従来、備考欄に自動入力されていた文言そのもの
const LEGACY_BLOCK = '【別料金】 ・火葬料金：\n　　　　　 ・お布施：\n　　　　　 ・新聞広告：\n【備考】'

describe('buildSeparateFeesText', () => {
    it('金額が未設定のときは見出しだけを出力する', () => {
        const text = buildSeparateFeesText({})
        expect(text).toBe(LEGACY_BLOCK)
    })

    it('金額を3桁カンマ区切り＋円で出力する', () => {
        const text = buildSeparateFeesText({ cremationFee: 25000, offeringFee: 900, newspaperAdFee: 1500 })
        expect(text).toBe(
            '【別料金】 ・火葬料金：25,000円\n　　　　　 ・お布施：900円\n　　　　　 ・新聞広告：1,500円\n【備考】'
        )
    })

    it('未入力の項目だけ空欄になる', () => {
        const text = buildSeparateFeesText({ cremationFee: 25000, offeringFee: null })
        expect(text).toContain('・火葬料金：25,000円')
        expect(text).toContain('・お布施：\n')
        expect(text).toContain('・新聞広告：\n')
    })

    it('0 は未入力ではなく 0円 として出力する', () => {
        const text = buildSeparateFeesText({ cremationFee: 0 })
        expect(text).toContain('・火葬料金：0円')
    })

    it('負値は他の金額欄と同じ会計表記にする', () => {
        const text = buildSeparateFeesText({ cremationFee: -1000 })
        expect(text).toContain('・火葬料金：▲1,000円')
    })
})

describe('parseSeparateFeesBlock', () => {
    it('ブロックがなければ何もしない', () => {
        const r = parseSeparateFeesBlock('通常の備考です')
        expect(r.found).toBe(false)
        expect(r.remarks).toBe('通常の備考です')
        expect(r.fees).toEqual({ cremationFee: null, offeringFee: null, newspaperAdFee: null })
    })

    it('null や空文字でも落ちない', () => {
        expect(parseSeparateFeesBlock(null).found).toBe(false)
        expect(parseSeparateFeesBlock('').found).toBe(false)
        expect(parseSeparateFeesBlock(undefined).remarks).toBeNull()
    })

    it('金額が未入力のブロックを取り除き、備考本文は残らない', () => {
        const r = parseSeparateFeesBlock(LEGACY_BLOCK)
        expect(r.found).toBe(true)
        expect(r.remarks).toBeNull()
        expect(r.fees).toEqual({ cremationFee: null, offeringFee: null, newspaperAdFee: null })
        expect(r.unparsable).toEqual([])
    })

    it('手入力された金額を取り出す', () => {
        const input = '【別料金】 ・火葬料金：25000\n　　　　　 ・お布施：900\n　　　　　 ・新聞広告：\n【備考】'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees).toEqual({ cremationFee: 25000, offeringFee: 900, newspaperAdFee: null })
        expect(r.remarks).toBeNull()
    })

    it('カンマ・円・全角数字・余分な空白が混じっていても数値にする', () => {
        const input = '【別料金】 ・火葬料金：25,000円\n　　　　　 ・お布施： ９００\n　　　　　 ・新聞広告：1 500\n【備考】'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees).toEqual({ cremationFee: 25000, offeringFee: 900, newspaperAdFee: 1500 })
    })

    it('【備考】の下に本文があれば残す', () => {
        const input = `${LEGACY_BLOCK}\nお花は別途手配します\n供物は式場へ直送`
        const r = parseSeparateFeesBlock(input)
        expect(r.remarks).toBe('お花は別途手配します\n供物は式場へ直送')
    })

    it('ブロックより前に本文があっても残す', () => {
        const input = `先方へ連絡済み\n${LEGACY_BLOCK}\n後片付けは翌日`
        const r = parseSeparateFeesBlock(input)
        expect(r.remarks).toBe('先方へ連絡済み\n後片付けは翌日')
    })

    it('金額として解釈できない記述は移さず報告する', () => {
        const input = '【別料金】 ・火葬料金：22万円\n　　　　　 ・お布施：45万円\n　　　　　 ・新聞広告：両紙\n【備考】'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees).toEqual({ cremationFee: null, offeringFee: null, newspaperAdFee: null })
        expect(r.unparsable).toEqual([
            { label: '火葬料金', raw: '22万円' },
            { label: 'お布施', raw: '45万円' },
            { label: '新聞広告', raw: '両紙' },
        ])
    })

    it('解釈できる項目と解釈できない項目が混在する場合、両方を返す', () => {
        const input = '【別料金】 ・火葬料金：25000\n　　　　　 ・お布施：\n　　　　　 ・新聞広告：80000〜\n【備考】'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees.cremationFee).toBe(25000)
        expect(r.unparsable).toEqual([{ label: '新聞広告', raw: '80000〜' }])
    })

    it('半角コロンで書かれていても拾う', () => {
        const input = '【別料金】 ・火葬料金:25000\n　　　　　 ・お布施:900\n　　　　　 ・新聞広告:\n【備考】'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees).toEqual({ cremationFee: 25000, offeringFee: 900, newspaperAdFee: null })
    })

    it('【備考】の行がなくても金額行までを取り除く', () => {
        const input = '【別料金】 ・火葬料金：25000\n　　　　　 ・お布施：\n　　　　　 ・新聞広告：\n式場は第2ホール'
        const r = parseSeparateFeesBlock(input)
        expect(r.fees.cremationFee).toBe(25000)
        expect(r.remarks).toBe('式場は第2ホール')
    })

    it('組み立てた文字列を解析すると元の金額に戻る', () => {
        const fees = { cremationFee: 25000, offeringFee: 0, newspaperAdFee: null }
        const r = parseSeparateFeesBlock(buildSeparateFeesText(fees))
        expect(r.fees).toEqual(fees)
        expect(r.remarks).toBeNull()
    })
})

// -------------------------------------------------------
// 請求書の支払合計ブロック
// -------------------------------------------------------
describe('calcInvoicePaymentTotal', () => {
    it('差引合計に生花代を足す', () => {
        expect(calcInvoicePaymentTotal(834900, 12000)).toBe(846900)
    })

    it('生花代が未入力なら差引合計と同額', () => {
        expect(calcInvoicePaymentTotal(834900, null)).toBe(834900)
        expect(calcInvoicePaymentTotal(834900, undefined)).toBe(834900)
    })

    it('生花代が0でも差引合計と同額', () => {
        expect(calcInvoicePaymentTotal(834900, 0)).toBe(834900)
    })
})

describe('buildInvoiceFeeLines', () => {
    it('葬儀代金・生花代・支払合計の3行を返す', () => {
        const lines = buildInvoiceFeeLines(834900, 12000)
        expect(lines.map((l) => `${l.label}：${l.amountText}`)).toEqual([
            '葬儀代金：834,900円',
            '生花代：12,000円',
            '支払合計：846,900円',
        ])
    })

    it('罫線は生花代の行にだけ引く', () => {
        const lines = buildInvoiceFeeLines(834900, 12000)
        expect(lines.map((l) => l.underline)).toEqual([false, true, false])
    })

    it('生花代が未入力ならラベルのみで、支払合計は葬儀代金と同額', () => {
        const lines = buildInvoiceFeeLines(834900, null)
        expect(lines[1].amountText).toBe('')
        expect(lines[2].amountText).toBe('834,900円')
    })

    it('生花代が0のときは0円と表示する（未入力と区別する）', () => {
        const lines = buildInvoiceFeeLines(834900, 0)
        expect(lines[1].amountText).toBe('0円')
    })

    it('差引合計が0でも0円と表示する', () => {
        const lines = buildInvoiceFeeLines(0, null)
        expect(lines[0].amountText).toBe('0円')
        expect(lines[2].amountText).toBe('0円')
    })
})

describe('buildBankTransferText', () => {
    const bank = {
        name: '琉球銀行',
        branch: '本店営業部',
        type: '普通',
        account: '1234567',
        holder: 'カ）ニホンフェニックス',
    }

    it('銀行名・支店名・口座種別・口座番号・口座名義を全角スペースで並べる', () => {
        expect(buildBankTransferText(bank)).toBe(
            'お振込先：琉球銀行　本店営業部　普通　1234567　カ）ニホンフェニックス'
        )
    })

    it('未登録の項目は区切りごと詰める', () => {
        expect(buildBankTransferText({ ...bank, branch: null, type: '' })).toBe(
            'お振込先：琉球銀行　1234567　カ）ニホンフェニックス'
        )
    })

    it('すべて未登録なら null（行自体を出さない）', () => {
        expect(buildBankTransferText({})).toBeNull()
        expect(buildBankTransferText({ name: '', branch: null, type: undefined, account: '  ' })).toBeNull()
    })

    it('前後の空白は取り除く', () => {
        expect(buildBankTransferText({ name: '  琉球銀行  ', account: ' 1234567 ' })).toBe(
            'お振込先：琉球銀行　1234567'
        )
    })
})
