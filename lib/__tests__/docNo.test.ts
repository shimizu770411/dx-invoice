import { describe, it, expect } from 'vitest'
import { buildDocNoPrefix, buildNextDocNo } from '@/lib/documentUtils'

/**
 * 見積番号は「葬儀・告別式の開始日時の年月(yyyymm) + 連番3桁」。
 * 年月は日本時間で決める。本番サーバー(UTC)の時刻のまま年月を取ると、
 * 月初 0〜9時の告別式が前月の番号になってしまう。
 */
describe('見積番号の年月', () => {
    it('日本時間で月初の早朝は、UTCでは前月でもその月として扱う', () => {
        // 2026-10-01 05:00 JST
        expect(buildDocNoPrefix(new Date('2026-09-30T20:00:00Z'))).toBe('202610')
    })

    it('日本時間で月末の夜は、UTCで同日でもその月として扱う', () => {
        // 2026-09-30 23:30 JST
        expect(buildDocNoPrefix(new Date('2026-09-30T14:30:00Z'))).toBe('202609')
    })

    it('年をまたぐ月初の早朝も日本時間の年月になる', () => {
        // 2027-01-01 03:00 JST
        expect(buildDocNoPrefix(new Date('2026-12-31T18:00:00Z'))).toBe('202701')
    })
})

describe('次の見積番号', () => {
    const funeralFrom = new Date('2026-10-05T01:00:00Z') // 2026-10-05 10:00 JST

    it('その月の番号がまだ無ければ 001 から', () => {
        expect(buildNextDocNo(funeralFrom, [])).toBe('202610001')
    })

    it('その月の最大値 + 1', () => {
        expect(buildNextDocNo(funeralFrom, ['202610001', '202610007', '202610003'])).toBe('202610008')
    })

    it('形式が正しくない番号（手入力の桁違いなど）は最大値の判定に使わない', () => {
        expect(buildNextDocNo(funeralFrom, ['202610002', '2026100099', null])).toBe('202610003')
    })
})
