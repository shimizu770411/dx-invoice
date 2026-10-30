// 請求書画面のチェックの付け外しの通しテスト。
// 請求書を開いたときの明細の組み立ては見積側とは別に書かれている（useInvoiceForm.ts）ため、
// 見積から作った直後に金額が一致するか、請求書画面で付け外ししても合計がずれないかを確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import {
    fillFreeRow,
    fillLinkedFreeRow,
    getLinkedFreeRow,
    getQtys,
    readScreenTotals,
    save,
    setChecked,
} from './helpers/itemTable'
import { readSaved } from './helpers/documents'
import { saveAndExpectConsistent } from './helpers/assertions'
import {
    findLinkedFreeRowProduct,
    findMultiRowWithFixed,
    findParentAltar,
    findPlainProduct,
    loadMaster,
    need,
    type MultiRowProduct,
} from './helpers/masterLookup'

// 連動処理を持つ商品は、商品名ではなく役割でその時の商品マスタから探す（helpers/masterLookup.ts）
const EXECUTION_SURCHARGE_ROW = '施行割増券'
const NEGATIVE_FREE_ROW = 'E2E値引'

describe('請求書画面: チェックの付け外し', () => {
    let session: Session
    let page: Page
    let pdfPage: Page
    let formalEstimateId = ''
    let invoiceId = ''
    let withFixed: MultiRowProduct | null = null
    let linkedFree: string | null = null

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        pdfPage = await session.newPage()
        const customerId = await createTestCase(session, '請求')

        const master = await loadMaster(session)
        const anchor = findPlainProduct(master)
        if (!anchor) throw new Error('E2E: 今の商品マスタに、下支えに使えるふつうの商品（特別な設定の無い一般商品）がありません')
        const parentAltar = findParentAltar(master)?.name ?? null
        withFixed = findMultiRowWithFixed(master)
        linkedFree = findLinkedFreeRowProduct(master)

        // 事前相談見積を画面から作り、本見積 → 請求書の順に画面と同じAPIで作る。
        // 品目0件では保存できないため、ふつうの商品を必ず1つ入れる（プランの初期セット品には頼らない）
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
        await setChecked(page, anchor, true)
        if (parentAltar) await setChecked(page, parentAltar, true)
        if (linkedFree) await setChecked(page, linkedFree, true)
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

    it('8. 請求書画面で付け外ししても、画面・保存値・PDFの合計が一致する', async (ctx) => {
        const MULTI_ROW_WITH_FIXED = need(ctx, withFixed, '固定料金の行を持つ複数行商品').name
        const WITH_LINKED_FREE_ROW = need(ctx, linkedFree, '追加行を持つ商品')
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

    it('11. 請求書でも自由項目にマイナスの金額を入れると、書類の会員区分の価格で合計が減る', async () => {
        const invoice = await readSaved(session, 'invoice', invoiceId)
        const before = await readScreenTotals(page)
        await fillFreeRow(page, { name: NEGATIVE_FREE_ROW, qty: 2, general: -15000, member: -10000 })
        const { screen } = await saveAndExpectConsistent(session, page, pdfPage, 'invoice', '請求書の自由項目にマイナス')
        const discount = (invoice.isMember ? -10000 : -15000) * 2
        expect(screen.subtotal, '小計がマイナス分だけ減る').toBe(before.subtotal + discount)
    })
})
