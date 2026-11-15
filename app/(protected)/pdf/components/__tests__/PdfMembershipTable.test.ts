import { describe, it, expect } from 'vitest'
import { buildStatusText } from '../PdfMembershipTable'

describe('互助会・やすらぎらん表の状況欄', () => {
    it('完納なら、状況の右に完納日を入会日と同じ形（元号記号＋yy/mm/dd）で出す', () => {
        // 完納日はDBの日付型で、この形で届く
        expect(buildStatusText({ status: 'COMPLETED', completedAt: '2025-10-01T00:00:00.000Z' })).toBe('完納 R07/10/01')
        expect(buildStatusText({ status: 'COMPLETED', completedAt: new Date('2019-04-30T00:00:00.000Z') })).toBe('完納 H31/04/30')
    })

    it('完納でも完納日が入っていなければ「完納」だけ', () => {
        expect(buildStatusText({ status: 'COMPLETED', completedAt: null })).toBe('完納')
    })

    it('継続中・保留は完納日が残っていても日付を出さない', () => {
        expect(buildStatusText({ status: 'ACTIVE', completedAt: '2025-10-01T00:00:00.000Z' })).toBe('継続中')
        expect(buildStatusText({ status: 'ON_HOLD', completedAt: '2025-10-01T00:00:00.000Z' })).toBe('保留')
    })

    it('状況が無ければ空', () => {
        expect(buildStatusText({ status: null })).toBe('')
    })
})
