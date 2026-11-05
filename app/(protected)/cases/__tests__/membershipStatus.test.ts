import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getFormDefaultValues, transformSubmitData } from '../hooks/useCaseFormConfig'
import type { CaseFormData } from '../schemas/CaseFormSchema'

/**
 * 会員タブ（互助会員1・2、けやき）の「状況」「完納日」が保存まで届くことを確認する。
 *
 * 完納日は状況が「完納」のときだけ意味を持つ。
 * 「保留なのに完納日が入っている」データを作らないよう、完納以外では完納日を送らない・保存しない。
 */

const ROOT = path.resolve(__dirname, '../../../..')
const formatDateForISO = (v: string | undefined) => (v ? new Date(v).toISOString() : null)

function buildData(status: string, completedAt: string): CaseFormData {
    const base = getFormDefaultValues() as CaseFormData
    return {
        ...base,
        receptionAt: '2026-11-05T10:00',
        deceasedName: 'テスト',
        age: 80,
        memberships: base.memberships.map((m, i) => (i === 0 ? { ...m, status, completedAt } : m)),
    } as CaseFormData
}

describe('会員の状況・完納日の送信変換', () => {
    it('完納なら状況と完納日がそのまま送られる', () => {
        const result: any = transformSubmitData(buildData('COMPLETED', '2026-10-01'), formatDateForISO)
        expect(result.memberships[0].status).toBe('COMPLETED')
        expect(result.memberships[0].completedAt).toBe(new Date('2026-10-01').toISOString())
    })

    it('完納以外では完納日が入っていても送られない', () => {
        for (const status of ['ACTIVE', 'ON_HOLD', '']) {
            const result: any = transformSubmitData(buildData(status, '2026-10-01'), formatDateForISO)
            expect(result.memberships[0].completedAt ?? null, `状況=${status}`).toBeNull()
        }
    })
})

describe('会員の状況・完納日の保存API', () => {
    const routes = ['app/api/customers/route.ts', 'app/api/customers/[id]/route.ts']

    for (const route of routes) {
        it(`${route} が状況を保存している`, () => {
            const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
            expect(source).toMatch(/status:\s*toNullIfEmpty\(membership\.status\)/)
        })

        it(`${route} が完納日を「完納」のときだけ保存している`, () => {
            const source = fs.readFileSync(path.join(ROOT, route), 'utf8')
            expect(source).toMatch(/completedAt:\s*\n?\s*membership\.status === 'COMPLETED' && membership\.completedAt/)
        })
    }
})
