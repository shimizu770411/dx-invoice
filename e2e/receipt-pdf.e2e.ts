// 領収書PDFの通しテスト。
// ・明細に選択されていない商品が出ないこと。以前は商品マスタの全商品を品名だけの空行として並べていたが、
//   請求書PDFと同じく選択された商品（数量が入っている明細）だけを出すようにした。
// ・PDFがA4 1ページに収まること。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'

// 領収書の明細欄（小計より上）で、品名が入っている行の「品名」と「金額」
async function receiptItemRows(page: Page, invoiceId: string): Promise<{ label: string; amount: string }[]> {
    await gotoAndSettle(page, `/pdf/receipt/${invoiceId}`)
    await page.waitForSelector('#receipt-pdf-content tbody')
    return page.evaluate(() =>
        // 最初の表が明細欄（右ブロックの施行日・故人名の表は別）
        Array.from(document.querySelector('#receipt-pdf-content table')?.querySelectorAll('tbody tr') ?? [])
            .map((tr) => {
                const tds = tr.querySelectorAll('td')
                return {
                    label: (tds[0]?.querySelector('div')?.textContent ?? '').trim(),
                    amount: (tds[3]?.textContent ?? '').trim(),
                }
            })
            // 余白の空行は除く
            .filter((r) => r.label !== '' || r.amount !== '')
    )
}

describe('領収書PDFの明細', () => {
    let session: Session
    let page: Page
    let invoiceId = ''
    let anchor = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        anchor = (await openBlankDocument(session, page, 'invoice', '領収書未選択')).anchor
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('選択した商品だけが出て、選択していない商品は出ない', async () => {
        const rows = await receiptItemRows(page, invoiceId)
        expect(rows.map((r) => r.label)).toEqual([anchor])
        expect(rows[0].amount, '選択した商品には金額が出る').not.toBe('')
    })

    // 以前は明細欄を37行で埋めていたため、行が少なくても小計〜差引合計が2ページ目に押し出されていた
    it('領収書PDFはA4 1ページに収まる', async () => {
        const res = await fetch(`${BASE_URL}/api/pdf/receipt/${invoiceId}`, {
            headers: { cookie: `access_token=${session.token}` },
        })
        expect(res.status).toBe(200)
        const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1')
        const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length
        expect(pages).toBe(1)
    })
})
