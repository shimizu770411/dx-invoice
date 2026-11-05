// 見積・請求書PDFの会員表の通しテスト。
// 「入金金額」の次に「状況」列が出ること、入会日が短い和暦（H21/09/08）で出ること、
// 完納日はPDFに出さないことを、見積PDF・請求書PDFの両方で確かめる。
// 列幅の確認用に、会員表の画像を /tmp/membership-pdf-*.png に保存する。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'

const MEMBERSHIPS = [
    {
        rowNo: 1,
        memberNo: '8504-225205',
        joinedAt: new Date('2009-09-08'),
        memberName: 'ツハ　トクジ',
        paymentAmountOnce: 3000,
        paymentTimes: 90,
        status: 'COMPLETED' as const,
        completedAt: new Date('2016-09-08'),
        relationToDeceased: '本人',
    },
    {
        rowNo: 2,
        memberNo: '8510-27223',
        joinedAt: new Date('2019-06-27'),
        // 長い名前でもフォントが縮んで1行に収まることを画像で見る
        memberName: 'ツハ　トクジロウエモンノスケ',
        paymentAmountOnce: 1500,
        paymentTimes: 88,
        status: 'ON_HOLD' as const,
        completedAt: null,
        salesStaffName: '中部広報',
        relationToDeceased: '本人',
    },
    { rowNo: 3, status: 'ACTIVE' as const },
]

// 会員表（見出しに「状況」がある表）の見出しと各行の文字
function readMembershipTable(page: Page) {
    return page.evaluate(() => {
        const table = Array.from(document.querySelectorAll('table')).find((t) =>
            Array.from(t.querySelectorAll('thead th')).some((th) => th.textContent?.trim() === '会員番号')
        )
        if (!table) return null
        return {
            headers: Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? ''),
            rows: Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
                Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/ /g, '').trim())
            ),
        }
    })
}

async function shotMembershipTable(page: Page, file: string) {
    await settle(page, 400)
    const rect = await page.evaluate(() => {
        const table = Array.from(document.querySelectorAll('table')).find((t) =>
            Array.from(t.querySelectorAll('thead th')).some((th) => th.textContent?.trim() === '会員番号')
        )
        const r = table?.parentElement?.getBoundingClientRect()
        return r ? { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height } : null
    })
    if (!rect) throw new Error('E2E: 会員表が見つかりません')
    await page.screenshot({ path: file, clip: { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16 } })
}

describe('見積・請求書PDFの会員表', () => {
    let session: Session
    let page: Page
    let estimateId = ''
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '会員表PDF')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: BigInt(invoiceId) } })
        const estimate = await prisma.estimate.findFirstOrThrow({
            where: { customerId: invoice.customerId },
            orderBy: { id: 'desc' },
        })
        estimateId = estimate.id.toString()
        // 会員情報はテスト用の案件に直接入れる（画面からの保存は membership-status.e2e.ts で確かめている）
        await prisma.customerMembership.createMany({
            data: MEMBERSHIPS.map((m) => ({ customerId: invoice.customerId, ...m })),
        })
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    for (const kind of ['estimate', 'invoice'] as const) {
        it(`${kind === 'estimate' ? '見積' : '請求書'}PDF: 入金金額の次に状況が出て、入会日は短い和暦`, async () => {
            await gotoAndSettle(page, `/pdf/${kind}/${kind === 'estimate' ? estimateId : invoiceId}`)
            const table = await readMembershipTable(page)
            expect(table).not.toBeNull()
            expect(table!.headers).toEqual([
                '会員番号',
                '入会日',
                '会員名',
                'コース',
                '入金回数',
                '入金金額',
                '状況',
                '営業担当者名',
                '故人との続柄',
            ])
            const [row1, row2, row3] = table!.rows
            expect(row1[1]).toBe('H21/09/08')
            expect(row1[5]).toBe('¥ 270,000')
            expect(row1[6]).toBe('完納')
            expect(row2[1]).toBe('R01/06/27')
            expect(row2[6]).toBe('保留')
            expect(row3[6]).toBe('継続中')

            await shotMembershipTable(page, `/tmp/membership-pdf-${kind}.png`)
        })
    }
})
