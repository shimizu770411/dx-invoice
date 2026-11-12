// 領収書承認の通しテスト。
// 事務員・決裁者が案件の操作ボタン「領収書承認」を押すと、その人の印影が領収書の取扱者印に出る。
// 承認しなくても領収書は発行できる（取扱者印が空欄になるだけ）。承認後は同じボタン（承認取消）で取り消せる。
// 入金を取り消すと承認も外れる。経理は入金を扱えるが承認はできない。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'

const tokenFor = async (role: 'CLERK' | 'ACCOUNTING') => {
    const user = await prisma.user.findFirst({ where: { role, isActive: true }, orderBy: { id: 'asc' } })
    return user ? { user, token: signToken({ sub: user.id.toString(), tel: user.tel }) } : null
}

// 領収書の取扱者印のマスの中身（印影の画像の src、または印影が未登録の人の名前）
async function handlerStampCell(page: Page, invoiceId: string): Promise<{ img: string | null; text: string }> {
    await gotoAndSettle(page, `/pdf/receipt/${invoiceId}`)
    await page.waitForSelector('#receipt-pdf-content tbody')
    return page.evaluate(() => {
        const header = Array.from(document.querySelectorAll('#receipt-pdf-content td')).find((td) => td.textContent?.trim() === '取扱者印')
        const row = header?.parentElement
        const index = row ? Array.from(row.children).indexOf(header!) : -1
        const cell = row?.nextElementSibling?.children[index] as HTMLElement | undefined
        return { img: cell?.querySelector('img')?.getAttribute('src') ?? null, text: (cell?.textContent ?? '').trim() }
    })
}

describe('領収書承認', () => {
    let session: Session
    let page: Page
    let invoiceId = ''
    let clerk: NonNullable<Awaited<ReturnType<typeof tokenFor>>>

    const call = async (token: string, path: string, body: unknown) => {
        const res = await fetch(`${BASE_URL}/api${path}`, {
            method: 'POST',
            headers: { cookie: `access_token=${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
        return { status: res.status, json: await res.json().catch(() => null) }
    }
    const pay = () => call(clerk.token, `/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-12', memo: '', receiptNo: '' })
    const cancelPayment = () => call(clerk.token, `/payments/invoice/${invoiceId}/cancel`, { paidAt: '2026-11-12', memo: '' })
    const approve = (token: string, value: boolean) => call(token, `/payments/invoice/${invoiceId}/receipt-approval`, { approve: value })

    beforeAll(async () => {
        assertLocalEnvironment()
        const found = await tokenFor('CLERK')
        if (!found) throw new Error('E2E: 事務員のユーザーがいません')
        clerk = found
        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '領収書承認')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('入金登録の前は承認できない', async () => {
        expect((await approve(clerk.token, true)).status).toBe(400)
    })

    it('承認していなければ、領収書の取扱者印は空欄', async () => {
        expect((await pay()).status).toBe(200)
        expect(await handlerStampCell(page, invoiceId)).toEqual({ img: null, text: '' })
    })

    it('事務員が承認すると、その人の印影（未登録なら名前）が取扱者印に出る', async () => {
        const res = await approve(clerk.token, true)
        expect(res.status).toBe(200)
        expect(res.json.isReceiptApproved).toBe(true)
        const cell = await handlerStampCell(page, invoiceId)
        if (clerk.user.sealImageUrl) expect(cell.img).toBe(clerk.user.sealImageUrl)
        else expect(cell.text).toBe(clerk.user.name)
    })

    it('承認を取り消すと、取扱者印は空欄に戻る', async () => {
        expect((await approve(clerk.token, false)).status).toBe(200)
        expect(await handlerStampCell(page, invoiceId)).toEqual({ img: null, text: '' })
    })

    it('経理は入金を扱えるが、承認はできない', async () => {
        // マスタに頼らないよう、経理のユーザーはテスト内で作って消す
        const accounting = await prisma.user.create({
            data: { name: 'E2E経理', tel: `e2e-acc-${Date.now()}`, password: 'x', role: 'ACCOUNTING' },
        })
        try {
            const token = signToken({ sub: accounting.id.toString(), tel: accounting.tel })
            expect((await approve(token, true)).status).toBe(403)
        } finally {
            await prisma.user.delete({ where: { id: accounting.id } })
        }
    })

    it('入金を取り消すと承認も外れ、入金登録し直しても未承認から始まる', async () => {
        expect((await approve(clerk.token, true)).status).toBe(200)
        expect((await cancelPayment()).status).toBe(200)
        expect((await pay()).status).toBe(200)
        expect(await handlerStampCell(page, invoiceId)).toEqual({ img: null, text: '' })
    })

    it('画面: 「入金登録」と「領収書発行」の間の「領収書承認」で承認でき、押すと「承認取消」に変わる', async () => {
        const clerkPage = await session.newPage()
        await clerkPage.setCookie({ name: 'access_token', value: clerk.token, domain: new URL(BASE_URL).hostname, path: '/' })
        await gotoAndSettle(clerkPage, `/invoices/${invoiceId}`)
        const navLabels = () =>
            clerkPage.evaluate(() =>
                Array.from(document.querySelectorAll('nav button')).map((b) => (b.textContent ?? '').replace(/\s/g, ''))
            )
        const labels = await navLabels()
        const payIndex = labels.findIndex((l) => l.includes('入金取消'))
        expect(labels[payIndex + 1], '入金の次').toContain('領収書承認')
        expect(labels[payIndex + 2], '承認の次').toContain('領収書発行')

        await clerkPage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('nav button')).find((x) => (x.textContent ?? '').includes('領収書承認'))
            ;(b as HTMLButtonElement).click()
        })
        await clerkPage.waitForFunction(
            () => Array.from(document.querySelectorAll('nav button')).some((x) => (x.textContent ?? '').includes('承認取消')),
            { timeout: 15_000 }
        )
        const latest = await prisma.payment.findFirst({
            where: { invoiceId: BigInt(invoiceId) },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        expect(latest?.receiptApprovedById?.toString()).toBe(clerk.user.id.toString())

        // 承認取消は確認を出してから行う（テスト用のページは確認に自動で「OK」を返す）
        await clerkPage.evaluate(() => {
            const b = Array.from(document.querySelectorAll('nav button')).find((x) => (x.textContent ?? '').includes('承認取消'))
            ;(b as HTMLButtonElement).click()
        })
        await clerkPage.waitForFunction(
            () => Array.from(document.querySelectorAll('nav button')).some((x) => (x.textContent ?? '').includes('領収書承認')),
            { timeout: 15_000 }
        )
        await settle(clerkPage, 300)
        expect(await handlerStampCell(page, invoiceId)).toEqual({ img: null, text: '' })
        await clerkPage.close()
    })
})
