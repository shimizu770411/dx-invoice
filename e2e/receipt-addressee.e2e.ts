// 入金登録の「領収書の宛名」の通しテスト。
// 支払者と喪主のどちらに宛てるかは案件で違うため、入金登録のときに宛名を入れ、領収書PDFの宛名に出す。
// 入金登録の画面では、宛名欄の初期値が「支払者名、それが空なら喪主名」で、「支払者」「喪主」のボタンで入れ替えられる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { RECEIPT_ADDRESSEE_MAX_LENGTH } from '@/lib/receiptAddressee'

const PAYER = '支払　花子'
const CHIEF = '喪主　太郎'

const latestPayment = (invoiceId: string) =>
    prisma.payment.findFirst({ where: { invoiceId: BigInt(invoiceId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })

// 領収書PDFの宛名（「様」の左）
async function receiptAddressee(page: Page, invoiceId: string): Promise<string> {
    await gotoAndSettle(page, `/pdf/receipt/${invoiceId}`)
    await page.waitForSelector('#receipt-pdf-content tbody')
    return page.evaluate(() => {
        const sama = Array.from(document.querySelectorAll('#receipt-pdf-content span')).find((s) => s.textContent === '様')
        return (sama?.previousElementSibling?.textContent ?? '').trim()
    })
}

// 宛名欄（「領収書の宛名」の見出しの下の入力欄）
const addresseeInput = (page: Page) =>
    page.evaluate(() => {
        const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '領収書の宛名')
        return (label?.parentElement?.querySelector('input') as HTMLInputElement | null)?.value ?? null
    })

describe('入金登録の領収書の宛名', () => {
    let session: Session
    let page: Page
    let invoiceId = ''
    let customerId = ''
    // 入金を扱えるロール（事務員）のユーザーの認証クッキー。テスト用の既定ユーザー（管理者）は入金を扱えない
    let clerkToken = ''

    const callApi = async (path: string, body: unknown) => {
        const res = await fetch(`${BASE_URL}/api${path}`, {
            method: 'POST',
            headers: { cookie: `access_token=${clerkToken}`, 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
        return { status: res.status, json: await res.json().catch(() => null) }
    }
    const pay = (body: Record<string, unknown>) =>
        callApi(`/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-12', memo: '', receiptNo: '', ...body })
    const cancel = () => callApi(`/payments/invoice/${invoiceId}/cancel`, { paidAt: '2026-11-12', memo: '' })

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        const clerk = await prisma.user.findFirst({ where: { role: 'CLERK', isActive: true }, orderBy: { id: 'asc' } })
        if (!clerk) throw new Error('E2E: 事務員のユーザーがいません')
        clerkToken = signToken({ sub: clerk.id.toString(), tel: clerk.tel })
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '領収書宛名')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: BigInt(invoiceId) } })
        customerId = invoice.customerId.toString()
        await prisma.customer.update({ where: { id: invoice.customerId }, data: { payerName: PAYER, chiefMournerName: CHIEF } })
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('入金登録で入れた宛名が保存され、領収書の宛名に出る', async () => {
        const res = await pay({ receiptAddressee: '  株式会社　沖縄  ' })
        expect(res.status).toBe(200)
        expect((await latestPayment(invoiceId))?.receiptAddressee, '前後の空白は除く').toBe('株式会社　沖縄')
        expect(await receiptAddressee(page, invoiceId)).toBe('株式会社　沖縄')
        await cancel()
    })

    it('宛名を空欄で登録すると、領収書は支払者名で出る（支払者が空なら喪主名）', async () => {
        expect((await pay({ receiptAddressee: '' })).status).toBe(200)
        expect((await latestPayment(invoiceId))?.receiptAddressee).toBeNull()
        expect(await receiptAddressee(page, invoiceId)).toBe(PAYER)

        await prisma.customer.update({ where: { id: BigInt(customerId) }, data: { payerName: null } })
        expect(await receiptAddressee(page, invoiceId)).toBe(CHIEF)
        await prisma.customer.update({ where: { id: BigInt(customerId) }, data: { payerName: PAYER } })
        await cancel()
    })

    it('上限文字数を超える宛名は保存しない', async () => {
        const res = await pay({ receiptAddressee: 'あ'.repeat(RECEIPT_ADDRESSEE_MAX_LENGTH + 1) })
        expect(res.status).toBe(400)
        expect((await latestPayment(invoiceId))?.status, '入金登録されていない').not.toBe('PAID')
    })

    it('入金登録の画面: 宛名の初期値は支払者名で、「喪主」「支払者」で入れ替えられ、入れた宛名で登録される', async () => {
        // 入金登録の画面は事務員として開く
        const clerkPage = await session.newPage()
        await clerkPage.setCookie({ name: 'access_token', value: clerkToken, domain: new URL(BASE_URL).hostname, path: '/' })
        await gotoAndSettle(clerkPage, `/invoices/${invoiceId}`)
        const clickButton = (text: string) =>
            clerkPage.evaluate((t) => {
                const b = Array.from(document.querySelectorAll('button')).find(
                    (x) => x.textContent?.trim() === t && !(x as HTMLButtonElement).disabled
                )
                ;(b as HTMLButtonElement | undefined)?.click()
                return !!b
            }, text)
        expect(await clickButton('入金登録'), '入金登録のボタン').toBe(true)
        await clerkPage.waitForFunction(
            () => {
                const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '領収書の宛名')
                return !!(label?.parentElement?.querySelector('input') as HTMLInputElement | null)?.value
            },
            { timeout: 15_000 }
        )
        expect(await addresseeInput(clerkPage), '初期値').toBe(PAYER)

        expect(await clickButton('喪主')).toBe(true)
        await settle(clerkPage, 200)
        expect(await addresseeInput(clerkPage), '「喪主」を押した後').toBe(CHIEF)
        expect(await clickButton('支払者')).toBe(true)
        await settle(clerkPage, 200)
        expect(await addresseeInput(clerkPage), '「支払者」を押した後').toBe(PAYER)

        // 自由に書き換えて登録する
        expect(await clickButton('喪主')).toBe(true)
        await settle(clerkPage, 200)
        await clerkPage.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '領収書の宛名')
            const input = label?.parentElement?.querySelector('input') as HTMLInputElement
            input.focus()
            input.select()
        })
        await clerkPage.keyboard.type('喪主　太郎　様方')
        expect(await clickButton('保　存')).toBe(true)
        await clerkPage.waitForFunction(() => !Array.from(document.querySelectorAll('label')).some((l) => l.textContent?.trim() === '領収書の宛名'), {
            timeout: 15_000,
        })
        expect((await latestPayment(invoiceId))?.receiptAddressee).toBe('喪主　太郎　様方')
        expect(await receiptAddressee(page, invoiceId)).toBe('喪主　太郎　様方')
    })
})
