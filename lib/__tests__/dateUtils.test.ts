import { describe, it, expect } from 'vitest'
import { parseDateRange, calculateDateRange, formatDateEraShort } from '../dateUtils'

// -------------------------------------------------------
// parseDateRange
// -------------------------------------------------------
describe('parseDateRange', () => {
    describe('YYYY-MM-DD 形式', () => {
        it('from/toが同じ日付になる', () => {
            expect(parseDateRange('2026-03-11')).toEqual({
                from: '2026-03-11',
                to: '2026-03-11',
            })
        })
    })

    describe('YYYY-MM 形式', () => {
        it('月初〜月末の範囲を返す（31日の月）', () => {
            expect(parseDateRange('2026-01')).toEqual({
                from: '2026-01-01',
                to: '2026-01-31',
            })
        })

        it('月初〜月末の範囲を返す（30日の月）', () => {
            expect(parseDateRange('2026-04')).toEqual({
                from: '2026-04-01',
                to: '2026-04-30',
            })
        })

        it('うるう年の2月は29日まで', () => {
            expect(parseDateRange('2024-02')).toEqual({
                from: '2024-02-01',
                to: '2024-02-29',
            })
        })

        it('平年の2月は28日まで', () => {
            expect(parseDateRange('2026-02')).toEqual({
                from: '2026-02-01',
                to: '2026-02-28',
            })
        })
    })

    describe('YYYY 形式', () => {
        it('年初〜年末の範囲を返す', () => {
            expect(parseDateRange('2026')).toEqual({
                from: '2026-01-01',
                to: '2026-12-31',
            })
        })
    })

    describe('無効な入力', () => {
        it('空文字はnullを返す', () => {
            expect(parseDateRange('')).toBeNull()
        })

        it('不正な文字列はnullを返す', () => {
            expect(parseDateRange('invalid')).toBeNull()
            expect(parseDateRange('20260')).toBeNull()
            expect(parseDateRange('2026-1')).toBeNull()
        })

        it('前後の空白は無視してパースする', () => {
            expect(parseDateRange('  2026  ')).toEqual({
                from: '2026-01-01',
                to: '2026-12-31',
            })
        })
    })
})

// -------------------------------------------------------
// calculateDateRange
// -------------------------------------------------------
describe('calculateDateRange', () => {
    it('fromInputのみ指定した場合、fromのみ返す', () => {
        const result = calculateDateRange('2026-03')
        expect(result.from).toBe('2026-03-01')
        expect(result.to).toBeUndefined()
    })

    it('toInputのみ指定した場合、toのみ返す', () => {
        const result = calculateDateRange(undefined, '2026-03')
        expect(result.from).toBeUndefined()
        expect(result.to).toBe('2026-03-31')
    })

    it('from/to両方指定した場合、それぞれの境界値を返す', () => {
        const result = calculateDateRange('2026-01', '2026-03')
        expect(result.from).toBe('2026-01-01')
        expect(result.to).toBe('2026-03-31')
    })

    it('引数なしの場合、空オブジェクトを返す', () => {
        expect(calculateDateRange()).toEqual({})
    })

    it('不正な値はスキップする', () => {
        const result = calculateDateRange('invalid', '2026-03')
        expect(result.from).toBeUndefined()
        expect(result.to).toBe('2026-03-31')
    })
})

// -------------------------------------------------------
// formatDateEraShort（PDF会員表の入会日・完納日：元号記号＋yy/mm/dd）
// -------------------------------------------------------
describe('formatDateEraShort', () => {
    it('平成・令和を H / R に置き換え、年月日を2桁にそろえる', () => {
        expect(formatDateEraShort('2009-09-08')).toBe('H21/09/08')
        expect(formatDateEraShort('2019-06-27')).toBe('R01/06/27')
        expect(formatDateEraShort('2026-11-05')).toBe('R08/11/05')
    })

    it('改元日の前後で元号が切り替わる', () => {
        expect(formatDateEraShort('2019-04-30')).toBe('H31/04/30')
        expect(formatDateEraShort('2019-05-01')).toBe('R01/05/01')
        expect(formatDateEraShort('1989-01-07')).toBe('S64/01/07')
        expect(formatDateEraShort('1989-01-08')).toBe('H01/01/08')
        expect(formatDateEraShort('1926-12-24')).toBe('T15/12/24')
        expect(formatDateEraShort('1926-12-25')).toBe('S01/12/25')
    })

    it('DBから来る日付（UTC 0時の日時文字列・Date）でも日付がずれない', () => {
        expect(formatDateEraShort('2009-09-08T00:00:00.000Z')).toBe('H21/09/08')
        expect(formatDateEraShort(new Date('2009-09-08T00:00:00.000Z'))).toBe('H21/09/08')
    })

    it('空・不正な値は空文字', () => {
        expect(formatDateEraShort(null)).toBe('')
        expect(formatDateEraShort(undefined)).toBe('')
        expect(formatDateEraShort('')).toBe('')
        expect(formatDateEraShort('abc')).toBe('')
    })
})
