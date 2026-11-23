// 見積書PDFの故人名の上にフリガナを出す件の通しテスト。
// フリガナを出すために見出し・故人名を小さくしているが、ヘッダーの高さが変わると明細表の行数計算が狂い
// 2ページ目にはみ出す。そこで「告別式」の行と明細表の見出し行の位置が、フリガナを出さない請求書PDF
// （同じ案件・同じレイアウト部品）と1pxも違わないことを確かめる。フリガナが空の案件でも同じく確かめる。
// 目視確認用に、ヘッダーの画像を /tmp/deceased-kana-*.png に保存する。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'

type HeaderLayout = {
    funeralRowTop: number
    itemTableTop: number
    kanaText: string | null
    /** 「故　○○○○　様」欄の文字そのもの（全角スペースが落ちていないかを見る） */
    nameBoxText: string
    /** フリガナの文字の中心と、故人名の文字の中心の左右のずれ(px) */
    kanaCenterOffset: number | null
}

// PDF本体の上端を0として、告別式の行・明細表の見出し行の位置を測る
function readHeaderLayout(page: Page, contentId: string): Promise<HeaderLayout> {
    return page.evaluate((id) => {
        const root = document.getElementById(id)
        if (!root) throw new Error(`${id} がありません`)
        const base = root.getBoundingClientRect().top
        const funeral = Array.from(root.querySelectorAll('div')).find((d) => d.textContent?.trim() === '告別式')
        const thead = Array.from(root.querySelectorAll('thead')).find((t) => t.textContent?.includes('品名'))
        const kana = root.querySelector('[data-testid="deceased-kana"]')
        const name = root.querySelector('[data-testid="deceased-name"]')
        // 要素の箱ではなく、文字が実際に描かれた範囲の中心（左右の余白を含めない）
        const textCenter = (el: Element) => {
            const range = document.createRange()
            range.selectNodeContents(el)
            const r = range.getBoundingClientRect()
            return (r.left + r.right) / 2
        }
        return {
            funeralRowTop: funeral ? funeral.getBoundingClientRect().top - base : NaN,
            itemTableTop: thead ? thead.getBoundingClientRect().top - base : NaN,
            kanaText: kana ? (kana.textContent ?? '') : null,
            nameBoxText: name?.parentElement?.textContent ?? '',
            kanaCenterOffset: kana && name && kana.textContent ? Math.abs(textCenter(kana) - textCenter(name)) : null,
        }
    }, contentId)
}

async function shotHeader(page: Page, contentId: string, file: string) {
    await settle(page, 400)
    const rect = await page.evaluate((id) => {
        const r = document.getElementById(id)!.getBoundingClientRect()
        return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width }
    }, contentId)
    await page.screenshot({ path: file, clip: { x: rect.x, y: rect.y, width: rect.width, height: 140 } })
}

describe('見積書PDFの故人名フリガナ', () => {
    let session: Session
    let page: Page
    let customerId = 0n
    let deceasedName = ''
    let estimateId = ''
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', 'フリガナPDF')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: BigInt(invoiceId) } })
        customerId = invoice.customerId
        deceasedName = (await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).deceasedName
        const estimate = await prisma.estimate.findFirstOrThrow({ where: { customerId }, orderBy: { id: 'desc' } })
        estimateId = estimate.id.toString()
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    async function measureBoth() {
        await gotoAndSettle(page, `/pdf/estimate/${estimateId}`)
        const estimate = await readHeaderLayout(page, 'estimate-pdf-content')
        await gotoAndSettle(page, `/pdf/invoice/${invoiceId}`)
        const invoice = await readHeaderLayout(page, 'invoice-pdf-content')
        return { estimate, invoice }
    }

    it('フリガナがあれば見積書にだけ「姓　名」で出て、告別式の行・明細表の位置は請求書と同じ', async () => {
        await prisma.customer.update({
            where: { id: customerId },
            data: { deceasedLastName: 'ヤマザト', deceasedFirstName: 'タロウ' },
        })
        const { estimate, invoice } = await measureBoth()

        expect(estimate.kanaText).toBe('ヤマザト　タロウ')
        expect(invoice.kanaText).toBeNull()
        // 「故」「様」と名前の間の全角スペースが両方に残っていること（見積・請求書とも）
        expect(estimate.nameBoxText).toBe(`故　${deceasedName}　様`)
        expect(invoice.nameBoxText).toBe(`故　${deceasedName}　様`)
        // フリガナが名前の真上（中心のずれ1px未満）に来ること
        expect(estimate.kanaCenterOffset).not.toBeNull()
        expect(estimate.kanaCenterOffset!).toBeLessThan(1)
        expect(Number.isFinite(estimate.funeralRowTop)).toBe(true)
        expect(estimate.funeralRowTop).toBe(invoice.funeralRowTop)
        expect(estimate.itemTableTop).toBe(invoice.itemTableTop)

        await gotoAndSettle(page, `/pdf/estimate/${estimateId}`)
        await shotHeader(page, 'estimate-pdf-content', '/tmp/deceased-kana-estimate.png')
    })

    it('フリガナが空でも見積書の告別式の行・明細表の位置は請求書と同じ', async () => {
        await prisma.customer.update({
            where: { id: customerId },
            data: { deceasedLastName: null, deceasedFirstName: null },
        })
        const { estimate, invoice } = await measureBoth()

        expect(estimate.kanaText ?? '').toBe('')
        expect(estimate.funeralRowTop).toBe(invoice.funeralRowTop)
        expect(estimate.itemTableTop).toBe(invoice.itemTableTop)

        await gotoAndSettle(page, `/pdf/estimate/${estimateId}`)
        await shotHeader(page, 'estimate-pdf-content', '/tmp/deceased-kana-empty.png')
    })
})
