// 入金登録の「領収書No.」（任意・数字7桁）の通しテスト。
// 入れた番号が保存され、請求書PDFの押印欄の No に出ること、7桁の数字以外は保存されないことを確かめる。
// 画面の入力欄を通さずにAPIを直接呼ばれても不正な値を保存しないよう、APIでも断る。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'

// 入金を扱えるロール（事務員）のユーザーとしてAPIを呼ぶ
async function callAsClerk(path: string, body: unknown) {
    const user = await prisma.user.findFirst({ where: { role: 'CLERK', isActive: true }, orderBy: { id: 'asc' } })
    if (!user) throw new Error('E2E: 事務員のユーザーがいません')
    const token = signToken({ sub: user.id.toString(), tel: user.tel })
    const res = await fetch(`${BASE_URL}/api${path}`, {
        method: 'POST',
        headers: { cookie: `access_token=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json().catch(() => null) }
}

const latestPayment = (invoiceId: string) =>
    prisma.payment.findFirst({ where: { invoiceId: BigInt(invoiceId) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })

// 請求書PDFの押印欄の No のマスの文字
async function pdfReceiptNoCell(page: Page, invoiceId: string): Promise<string> {
    await gotoAndSettle(page, `/pdf/invoice/${invoiceId}`)
    await page.waitForSelector('#invoice-pdf-content tfoot')
    return page.evaluate(() => {
        const noCell = Array.from(document.querySelectorAll('#invoice-pdf-content td')).find((td) => td.textContent?.trim() === 'No')
        return (noCell?.nextElementSibling?.textContent ?? '').trim()
    })
}

describe('入金登録の領収書No.', () => {
    let session: Session
    let page: Page
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '領収書No')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('7桁の数字以外（6桁・8桁・英字まじり）は保存されない', async () => {
        for (const receiptNo of ['625310', '62531080', '625310A']) {
            const res = await callAsClerk(`/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-05', memo: '', receiptNo })
            expect(res.status, `${receiptNo} は断る`).toBe(400)
            expect(res.json?.error, '理由').toContain('7桁の数字')
        }
        expect(await latestPayment(invoiceId), '入金は作られない').toBeNull()
    })

    it('7桁の数字で入金登録すると保存され、請求書PDFの押印欄の No に出る', async () => {
        const res = await callAsClerk(`/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-05', memo: '', receiptNo: '6253108' })
        expect(res.status).toBe(200)
        expect((await latestPayment(invoiceId))?.receiptNo).toBe('6253108')
        expect(await pdfReceiptNoCell(page, invoiceId), 'PDFの No').toBe('6253108')
    })

    it('入金を取り消すと、PDFの No は空欄に戻る', async () => {
        const res = await callAsClerk(`/payments/invoice/${invoiceId}/cancel`, { paidAt: '2026-11-05', memo: '' })
        expect(res.status).toBe(200)
        expect(await pdfReceiptNoCell(page, invoiceId), 'PDFの No').toBe('')
    })

    it('領収書No.を空欄にしても入金登録でき、PDFの No は空欄（手書きできる）', async () => {
        const res = await callAsClerk(`/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-05', memo: '', receiptNo: '' })
        expect(res.status).toBe(200)
        expect((await latestPayment(invoiceId))?.receiptNo).toBeNull()
        expect(await pdfReceiptNoCell(page, invoiceId), 'PDFの No').toBe('')
    })

    it('入金登録の画面に領収書No.の欄があり、入金取消の画面には無い', async () => {
        const hasField = async () =>
            page.evaluate(() => Array.from(document.querySelectorAll('label')).some((l) => (l.textContent ?? '').startsWith('領収書No.')))
        const openPaymentDialog = async (label: RegExp) => {
            await gotoAndSettle(page, '/cases')
            await settle(page, 1000)
            const opened = await page.evaluate((src: string) => {
                const re = new RegExp(src)
                const row = Array.from(document.querySelectorAll('button')).find(
                    (b) => re.test(b.textContent ?? '') && !(b as HTMLButtonElement).disabled
                )
                ;(row as HTMLButtonElement | undefined)?.click()
                return !!row
            }, label.source)
            await settle(page, 600)
            return opened
        }
        // テスト用の案件は入金済み（直前の場面）なので、ほかの未入金の案件で入金登録の画面を開く
        if (await openPaymentDialog(/入金登録/)) expect(await hasField(), '入金登録の画面').toBe(true)
        await page.keyboard.press('Escape')
        if (await openPaymentDialog(/入金取消/)) expect(await hasField(), '入金取消の画面').toBe(false)
    })
})
