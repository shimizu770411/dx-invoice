// 入金の登録・取消を、事務員・経理・決裁者だけに許すことの通しテスト。
// 画面のボタンを押せなくするだけでは、APIを直接呼べば担当者でも入金できてしまうため、APIで断ることを確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import { save, setChecked } from './helpers/itemTable'

// 指定したロールの有効なユーザーとしてAPIを呼ぶ
async function callAs(role: string, path: string, body: unknown) {
    const user = await prisma.user.findFirst({ where: { role, isActive: true }, orderBy: { id: 'asc' } })
    if (!user) throw new Error(`E2E: ロール ${role} のユーザーがいません`)
    const token = signToken({ sub: user.id.toString(), tel: user.tel })
    const res = await fetch(`${BASE_URL}/api${path}`, {
        method: 'POST',
        headers: { cookie: `access_token=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return res.status
}

const paidCount = (invoiceId: string) =>
    prisma.payment.count({ where: { invoiceId: BigInt(invoiceId), status: 'PAID' } })

describe('入金の登録・取消の権限', () => {
    let session: Session
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        const page = await session.newPage()
        const customerId = await createTestCase(session, '入金権限')
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
        await setChecked(page, '式場祭壇', true)
        const preId = await save(page)
        const formal = await session.api('POST', `/estimates/${preId}/confirm`)
        const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formal.json.id}`)
        if (invoice.status !== 200) throw new Error(`E2E: 請求書を作成できません (${invoice.status})`)
        invoiceId = String(invoice.json.id)
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('担当者は入金を登録できない（APIが断り、入金も作られない）', async () => {
        expect(await callAs('STAFF', `/payments/invoice/${invoiceId}/paid`, { paidAt: new Date().toISOString(), memo: 'E2E' })).toBe(403)
        expect(await paidCount(invoiceId)).toBe(0)
    })

    it('事務員は入金を登録できる', async () => {
        expect(await callAs('CLERK', `/payments/invoice/${invoiceId}/paid`, { paidAt: new Date().toISOString(), memo: 'E2E' })).toBe(200)
        expect(await paidCount(invoiceId)).toBe(1)
    })

    it('担当者は入金を取り消せない', async () => {
        expect(await callAs('STAFF', `/payments/invoice/${invoiceId}/cancel`, { paidAt: new Date().toISOString(), memo: 'E2E' })).toBe(403)
    })

    it('決裁者は入金を取り消せる', async () => {
        expect(await callAs('APPROVER', `/payments/invoice/${invoiceId}/cancel`, { paidAt: new Date().toISOString(), memo: 'E2E' })).toBe(200)
    })
})
