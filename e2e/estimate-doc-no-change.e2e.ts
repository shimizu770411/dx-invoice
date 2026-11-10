// 請求書作成後の見積番号変更の通しテスト。
// 間違った番号のまま請求書を作ると、見積は閲覧のみになり番号を直せず、その番号を本来付けるべき別の見積で使えなくなる。
// 「見積番号を変更」で見積番号と請求番号をまとめて変え、旧番号を別の見積で使えるようになることを確かめる。
// 請求書作成後の本見積は、番号の変更以外の更新をAPIでも断る。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { save, setChecked } from './helpers/itemTable'
import { findPlainProduct, loadMaster } from './helpers/masterLookup'

// テストで使う番号。実データと重ならないよう、遠い将来の年月にする
const WRONG_DOC_NO = '209901901'
const NEW_DOC_NO = '209901902'
// 見積画面の見積番号欄（変更ダイアログの入力欄とは aria-label の有無で見分ける）
const FORM_DOC_NO_INPUT = 'input[placeholder="例: 202607001"]:not([aria-label])'

// 入金を扱えるロール（事務員）のユーザーとしてAPIを呼ぶ（receipt-no.e2e.ts と同じ）
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

const estimateDocNo = async (id: string) =>
    (await prisma.estimate.findUnique({ where: { id: BigInt(id) }, select: { docNo: true } }))?.docNo
const invoiceDocNo = async (id: string) =>
    (await prisma.invoice.findUnique({ where: { id: BigInt(id) }, select: { docNo: true } }))?.docNo

describe('請求書作成後の見積番号変更', () => {
    let session: Session
    let page: Page
    let estimateId = ''
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        // テスト用の番号が残っていたら（前回の失敗など）始められないので止める。実データには触れない
        const leftover = await prisma.estimate.count({ where: { docNo: { in: [WRONG_DOC_NO, NEW_DOC_NO] } } })
        if (leftover > 0) throw new Error(`E2E: テスト用の見積番号（${WRONG_DOC_NO}・${NEW_DOC_NO}）が既に使われています`)

        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '見積番号変更')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(invoiceId) }, select: { fromEstimateId: true } })
        estimateId = invoice!.fromEstimateId!.toString()

        // 「間違った番号のまま請求書を作った」状態にする（見積・請求書とも同じ間違った番号）
        await prisma.estimate.update({ where: { id: BigInt(estimateId) }, data: { docNo: WRONG_DOC_NO } })
        await prisma.invoice.update({ where: { id: BigInt(invoiceId) }, data: { docNo: WRONG_DOC_NO } })
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('請求書作成後の本見積は、通常の更新をAPIでも断る', async () => {
        const res = await session.api('PUT', `/estimates/${estimateId}`, { docNo: NEW_DOC_NO, items: [] })
        expect(res.status).toBe(400)
        expect(res.json?.error).toContain('請求書が作成済み')
        expect(await estimateDocNo(estimateId), '番号は変わらない').toBe(WRONG_DOC_NO)
    })

    it('9桁の数字でない番号には変更できない', async () => {
        for (const docNo of ['20990190', '2099019010', '20990190A', '']) {
            const res = await session.api('PUT', `/estimates/${estimateId}/doc-no`, { docNo })
            expect(res.status, `「${docNo}」は断る`).toBe(400)
        }
        expect(await estimateDocNo(estimateId)).toBe(WRONG_DOC_NO)
    })

    it('入金済みでも、見積番号を変えると請求番号も同じ番号に変わる', async () => {
        const paid = await callAsClerk(`/payments/invoice/${invoiceId}/paid`, { paidAt: '2026-11-10', memo: '' })
        expect(paid.status, '入金登録').toBe(200)

        const res = await session.api('PUT', `/estimates/${estimateId}/doc-no`, { docNo: NEW_DOC_NO })
        expect(res.status).toBe(200)
        expect(res.json?.docNo).toBe(NEW_DOC_NO)
        expect(await estimateDocNo(estimateId), '見積番号').toBe(NEW_DOC_NO)
        expect(await invoiceDocNo(invoiceId), '請求番号').toBe(NEW_DOC_NO)
    })

    it('外れた旧番号を、本来付けるべき別の見積で使えるようになる', async () => {
        // 別の案件で事前相談見積→本見積を作り、本見積の画面で旧番号を入力して保存する
        const product = findPlainProduct(await loadMaster(session))
        if (!product) throw new Error('E2E: 今の商品マスタに、ふつうの商品がありません')
        const otherCustomerId = await createTestCase(session, '見積番号変更_別案件')
        await gotoAndSettle(page, `/estimates/new?customerId=${otherCustomerId}`)
        await setChecked(page, product, true)
        const preId = await save(page)
        const formal = await session.api('POST', `/estimates/${preId}/confirm`)
        expect(formal.status, '本見積の作成').toBe(200)

        await gotoAndSettle(page, `/estimates/${formal.json.id}`)
        await page.click(FORM_DOC_NO_INPUT, { clickCount: 3 })
        await page.type(FORM_DOC_NO_INPUT, WRONG_DOC_NO)
        await save(page)
        expect(await estimateDocNo(formal.json.id)).toBe(WRONG_DOC_NO)
    })

    it('他の見積で使用中の番号には変更できない', async () => {
        const res = await session.api('PUT', `/estimates/${estimateId}/doc-no`, { docNo: WRONG_DOC_NO })
        expect(res.status).toBe(400)
        expect(res.json?.error).toContain('既に他の見積')
        expect(await estimateDocNo(estimateId)).toBe(NEW_DOC_NO)
        expect(await invoiceDocNo(invoiceId)).toBe(NEW_DOC_NO)
    })

    it('自動採番で変更すると、葬儀日の年月の空いている番号が見積・請求書の両方に付く', async () => {
        const res = await session.api('PUT', `/estimates/${estimateId}/doc-no`, { auto: true })
        expect(res.status, res.json?.error).toBe(200)
        const docNo = res.json?.docNo as string
        // テスト用の案件の葬儀日は 2026-11-20（createTestCase）
        expect(docNo).toMatch(/^202611\d{3}$/)
        expect(await estimateDocNo(estimateId)).toBe(docNo)
        expect(await invoiceDocNo(invoiceId)).toBe(docNo)
    })

    it('事前相談見積の番号は変更できない', async () => {
        const pre = await prisma.estimate.findFirst({
            where: { customer: { invoices: { some: { id: BigInt(invoiceId) } } }, estimateType: 'PRE_CONSULTATION' },
            select: { id: true },
        })
        const res = await session.api('PUT', `/estimates/${pre!.id}/doc-no`, { docNo: '209901903' })
        expect(res.status).toBe(400)
        expect(res.json?.error).toContain('事前相談見積')
    })

    it('見積画面の「見積番号を変更」から番号を変えられ、画面の番号も変わる', async () => {
        await gotoAndSettle(page, `/estimates/${estimateId}`)
        const clickButton = (label: string) =>
            page.evaluate((text: string) => {
                const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
                ;(button as HTMLButtonElement | undefined)?.click()
                return !!button
            }, label)

        expect(await clickButton('見積番号を変更'), '閲覧のみの帯にボタンがある').toBe(true)
        await settle(page)
        await page.type('input[aria-label="新しい見積番号"]', NEW_DOC_NO)
        expect(await clickButton('この番号に変更')).toBe(true)
        await settle(page, 1500)

        expect(await estimateDocNo(estimateId)).toBe(NEW_DOC_NO)
        expect(await invoiceDocNo(invoiceId)).toBe(NEW_DOC_NO)
        const shown = await page.$eval(FORM_DOC_NO_INPUT, (el) => (el as HTMLInputElement).value)
        expect(shown, '画面の見積番号').toBe(NEW_DOC_NO)
    })
})
