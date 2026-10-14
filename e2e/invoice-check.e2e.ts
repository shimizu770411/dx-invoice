// 請求書画面のチェックの付け外しの通しテスト。
// 請求書を開いたときの明細の組み立ては見積側とは別に書かれている（useInvoiceForm.ts）ため、
// 見積から作った直後に金額が一致するか、請求書画面で付け外ししても合計がずれないかを確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import {
    fillLinkedFreeRow,
    getLinkedFreeRow,
    getQtys,
    readScreenTotals,
    save,
    setChecked,
} from './helpers/itemTable'
import { readSaved } from './helpers/documents'
import { saveAndExpectConsistent } from './helpers/assertions'

const PARENT_ALTAR = '式場祭壇'
const MULTI_ROW_WITH_FIXED = '会葬礼状'
const WITH_LINKED_FREE_ROW = '控室管理費'
const EXECUTION_SURCHARGE_ROW = '施行割増券'

describe('請求書画面: チェックの付け外し', () => {
    let session: Session
    let page: Page
    let pdfPage: Page
    let formalEstimateId = ''
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        pdfPage = await session.newPage()
        const customerId = await createTestCase(session, '請求')

        // 事前相談見積を画面から作り、本見積 → 請求書の順に画面と同じAPIで作る
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
        await setChecked(page, PARENT_ALTAR, true)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        const preId = await save(page)
        const formal = await session.api('POST', `/estimates/${preId}/confirm`)
        if (formal.status !== 200) throw new Error(`E2E: 本見積を作成できません (${formal.status})`)
        formalEstimateId = String(formal.json.id)
        const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formalEstimateId}`)
        if (invoice.status !== 200) throw new Error(`E2E: 請求書を作成できません (${invoice.status} ${invoice.json?.error ?? ''})`)
        invoiceId = String(invoice.json.id)
        await gotoAndSettle(page, `/invoices/${invoiceId}`)
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('7. 見積から作った直後の請求書は、元の本見積と合計が一致し、画面の合計も保存値と一致する', async () => {
        const estimate = await readSaved(session, 'estimate', formalEstimateId)
        const invoice = await readSaved(session, 'invoice', invoiceId)
        const pick = (t: { subtotal: number; tax: number; total: number; grandTotal: number }) => ({
            subtotal: t.subtotal,
            tax: t.tax,
            total: t.total,
            grandTotal: t.grandTotal,
        })
        expect(pick(invoice), '請求書と元の本見積の保存値').toEqual(pick(estimate))
        expect(invoice.docNo, '請求番号は見積番号を引き継ぐ').toBe(estimate.docNo)

        const screen = await readScreenTotals(page)
        expect(pick(screen), '請求書を開いた画面の合計と保存値').toEqual(pick(invoice))
    })

    it('8. 請求書画面で付け外ししても、画面・保存値・PDFの合計が一致する', async () => {
        const before = await readScreenTotals(page)
        await setChecked(page, MULTI_ROW_WITH_FIXED, true)
        await setChecked(page, MULTI_ROW_WITH_FIXED, false)
        const qtys = await getQtys(page, MULTI_ROW_WITH_FIXED)
        expect(qtys.every((q) => q === 0), `固定料金の行を持つ商品が全行0（${qtys}）`).toBe(true)
        expect((await readScreenTotals(page)).subtotal, '付けて外すと小計が元に戻る').toBe(before.subtotal)

        expect(await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW), '追加行が出ている').not.toBeNull()
        await fillLinkedFreeRow(page, WITH_LINKED_FREE_ROW, { name: 'E2E追加', qty: 3, general: 2000, member: 1500 })
        await saveAndExpectConsistent(session, page, pdfPage, 'invoice', '請求書で追加行を入力')

        await setChecked(page, WITH_LINKED_FREE_ROW, false)
        await saveAndExpectConsistent(session, page, pdfPage, 'invoice', '請求書で追加行の親を外した後')
    })

    it('9. 請求書画面の下部に、施行割増券の固定行がある', async () => {
        const hasRow = await page.evaluate(
            (name: string) =>
                Array.from(document.querySelectorAll('table tbody tr')).some((tr) =>
                    (tr.textContent ?? '').includes(name)
                ),
            EXECUTION_SURCHARGE_ROW
        )
        expect(hasRow, `${EXECUTION_SURCHARGE_ROW} の行`).toBe(true)
    })
})
