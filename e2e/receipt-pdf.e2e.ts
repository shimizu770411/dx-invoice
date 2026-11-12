// 領収書PDFの通しテスト。
// ・明細に選択されていない商品が出ないこと。以前は商品マスタの全商品を品名だけの空行として並べていたが、
//   請求書PDFと同じく選択された商品（数量が入っている明細）だけを出すようにした。
// ・PDFがA4 1ページに収まること。
// ・請求書PDFで金額の代わりに「セット」「サービス」等と出る明細は、領収書でも同じ文言を出すこと。
// ・会社設定で登録した角印を出すこと。
// ・金額と小計は請求書PDFと同じ計算で出すこと（セット商品が定価のまま保存された古い書類でも一致する）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { findParentAltar, loadMaster, need } from './helpers/masterLookup'
import { save, setChecked } from './helpers/itemTable'
import { NO_CHARGE_LABELS } from '@/lib/documentTotals'
import { prisma } from '@/lib/prisma'

const NO_CHARGE_TEXTS = Object.values(NO_CHARGE_LABELS)

// 請求書PDFの明細で、金額の代わりに「セット」等が出ている欄の文言（上から順）。
// 書類の会員区分に対応する金額欄は、各行のいちばん右の欄（一般の書類には会員価格列が無い）
async function invoicePdfNoChargeLabels(page: Page, invoiceId: string): Promise<string[]> {
    await gotoAndSettle(page, `/pdf/invoice/${invoiceId}`)
    await page.waitForSelector('#invoice-pdf-content tfoot')
    return page.evaluate((texts) => {
        return Array.from(document.querySelectorAll('#invoice-pdf-content tr'))
            .map((tr) => {
                const tds = tr.querySelectorAll('td')
                return (tds[tds.length - 1]?.textContent ?? '').trim()
            })
            .filter((t) => texts.includes(t))
    }, NO_CHARGE_TEXTS)
}

// PDFの「小計」行の金額（書類の会員区分に対応する、いちばん右の欄）
async function pdfSubtotal(page: Page, path: string, contentSelector: string): Promise<string> {
    await gotoAndSettle(page, path)
    await page.waitForSelector(`${contentSelector} tfoot`)
    return page.evaluate((sel) => {
        const tr = Array.from(document.querySelectorAll(`${sel} tr`)).find((r) =>
            (r.textContent ?? '').replace(/\s/g, '').startsWith('小計')
        )
        const tds = tr ? Array.from(tr.querySelectorAll('td')) : []
        return (tds[tds.length - 1]?.textContent ?? '').trim()
    }, contentSelector)
}

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

    // 手書きの領収証と同じく、会社設定で登録した角印を会社名の横（「玉泉院」の右端）に押す
    it('会社設定に角印が登録されていれば、領収書に角印が出る', async (ctx) => {
        const company = await prisma.companyProfile.findFirst()
        need(ctx, company?.sealImageUrl, '会社設定に登録された角印')
        await gotoAndSettle(page, `/pdf/receipt/${invoiceId}`)
        await page.waitForSelector('#receipt-pdf-content tbody')
        const src = await page.evaluate(
            () => (document.querySelector('#receipt-pdf-content img[alt="角印"]') as HTMLImageElement | null)?.src ?? null
        )
        expect(src, '角印の画像').not.toBeNull()
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

    // 金額欄の「セット」等は、請求書PDFと領収書で同じ明細に同じ文言が出る
    it('請求書PDFで「セット」と出る明細は、領収書でも「セット」と出る', async (ctx) => {
        const parent = need(ctx, findParentAltar(await loadMaster(session)), '子商品を持つ親祭壇')
        await openBlankDocument(session, page, 'invoice', '領収書セット表示')
        const setInvoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        // 親祭壇を入れると子商品が連動して入り、セット（0円）扱いになる
        await setChecked(page, parent.name, true)
        await save(page)

        const invoiceLabels = await invoicePdfNoChargeLabels(page, setInvoiceId)
        expect(invoiceLabels.filter((l) => l === 'セット').length, '請求書PDFにセットの明細がある').toBeGreaterThan(0)
        const receiptLabels = (await receiptItemRows(page, setInvoiceId))
            .map((r) => r.amount)
            .filter((a) => NO_CHARGE_TEXTS.includes(a))
        expect(receiptLabels).toEqual(invoiceLabels)
    })

    // 「セット」の控えを保存する前に作られた古い書類は、セット商品が定価のまま保存されている。
    // 領収書が保存値を足していたため、請求書PDFより合計が多く出ていた
    it('セット商品が定価のまま保存された古い書類でも、領収書の小計は請求書PDFと一致する', async (ctx) => {
        const parent = need(ctx, findParentAltar(await loadMaster(session)), '子商品を持つ親祭壇')
        await openBlankDocument(session, page, 'invoice', '領収書古い書類')
        const oldInvoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        await setChecked(page, parent.name, true)
        await save(page)

        // 控えを外し、金額を定価で保存した状態にして古い書類を再現する
        const noChargeItems = await prisma.invoiceItem.findMany({
            where: { invoiceId: BigInt(oldInvoiceId), qty: { gt: 0 }, noChargeReason: { not: null } },
        })
        expect(noChargeItems.length, 'セットの明細がある').toBeGreaterThan(0)
        for (const it of noChargeItems) {
            await prisma.invoiceItem.update({
                where: { id: it.id },
                data: { noChargeScope: null, noChargeReason: null, amount: it.unitPriceMember * it.qty },
            })
        }

        const invoiceSubtotal = await pdfSubtotal(page, `/pdf/invoice/${oldInvoiceId}`, '#invoice-pdf-content')
        const receiptSubtotal = await pdfSubtotal(page, `/pdf/receipt/${oldInvoiceId}`, '#receipt-pdf-content')
        expect(receiptSubtotal).toBe(invoiceSubtotal)
    })
})
