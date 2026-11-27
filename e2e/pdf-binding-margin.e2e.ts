// 見積書・請求書PDFの上端の綴じしろ・下端の余白の通しテスト。
// 上閉じで綴じると上端の表示が切れると客先から指摘があり、本体全体を5mm下げた（2026-11-26）。
// また、プリンターによって一番下の罫線が切れるため、下端にも2mmの余白を足した（2026-11-27）。
// 下げた分は明細表の行間（自動計算）と備考欄の高さで吸収するため、
// ・外枠の上端がページ上端から5mm下がっていること
// ・明細表の最下段（差引合計額）が外枠の中に収まっていること
// ・備考を入力上限まで入れても、最終行が備考欄の下端で切れないこと
// ・PDFが1ページに収まること
// を見積書・請求書の両方で確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { ESTIMATE_REMARKS_ROWS, INVOICE_REMARKS_ROWS, REMARKS_LINE_LENGTH } from '@/components/document/DocumentOtherFields'
import { PX_PER_MM } from '@/app/(protected)/pdf/components/pdfLayoutConstants'

const BINDING_MARGIN_MM = 5
// 下端の余白の追加分。用紙の余白（約4.2mm）だけでは、プリンターによって一番下の罫線が切れた（2026-11-27）
const BOTTOM_EXTRA_MARGIN_MM = 2
// ブラウザの端数の丸め
const SUBPIXEL_TOLERANCE_PX = 0.5
// 備考1行に入る最大の文字（全角24文字）
const FULL_REMARKS_LINE = 'あ'.repeat(REMARKS_LINE_LENGTH)

type Layout = {
    /** PDF本体の上端から外枠の上端まで(px) */
    frameTopOffset: number
    /** 外枠の下端 − 差引合計額の行の下端(px)。負なら差引合計額が切れている */
    grandTotalRoom: number
    /** 備考欄の下端 − 備考の最終行の下端(px)。負なら最終行が切れている */
    remarksRoom: number
    /** ページ本体の下端 − いちばん下の罫線（会員表）の下端(px) */
    bottomMargin: number
}

function readLayout(page: Page, contentId: string): Promise<Layout> {
    return page.evaluate((id) => {
        const root = document.getElementById(id)!
        const frame = Array.from(root.querySelectorAll('div')).find((d) => d.classList.contains('border-2') && d.style.overflow === 'hidden')!
        const frameRect = frame.getBoundingClientRect()
        const grandTotal = Array.from(frame.querySelectorAll('tr')).find((tr) =>
            (tr.textContent ?? '').replace(/\s/g, '').startsWith('差引合計額')
        )!
        // 備考欄は「(備考)」の見出しの次の要素で、はみ出した分はここで切られる
        const label = Array.from(frame.querySelectorAll('div')).find((d) => d.textContent === '(備考)')!
        const clip = label.nextElementSibling as HTMLElement
        const range = document.createRange()
        range.selectNodeContents(clip.lastElementChild!)
        const textBottom = Math.max(...Array.from(range.getClientRects()).map((r) => r.bottom))
        // ページ本体（1ページ分の高さに固定した枠）と、その中でいちばん下にある要素
        const body = frame.parentElement!
        const contentBottom = Math.max(...Array.from(body.querySelectorAll('*')).map((e) => e.getBoundingClientRect().bottom))
        return {
            frameTopOffset: frameRect.top - root.getBoundingClientRect().top,
            grandTotalRoom: frameRect.bottom - grandTotal.getBoundingClientRect().bottom,
            remarksRoom: clip.getBoundingClientRect().bottom - textBottom,
            bottomMargin: body.getBoundingClientRect().bottom - contentBottom,
        }
    }, contentId)
}

async function pdfPageCount(session: Session, path: string): Promise<number> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { cookie: `access_token=${session.token}` } })
    expect(res.status).toBe(200)
    const pdf = Buffer.from(await res.arrayBuffer()).toString('latin1')
    return (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe('見積書・請求書PDFの上端の綴じしろ', () => {
    let session: Session
    let page: Page
    let estimateId = ''
    let invoiceId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        await openBlankDocument(session, page, 'invoice', '綴じしろ')
        invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: BigInt(invoiceId) } })
        const estimate = await prisma.estimate.findFirstOrThrow({ where: { customerId: invoice.customerId }, orderBy: { id: 'desc' } })
        estimateId = estimate.id.toString()
        // 備考は入力上限の行数まで、1行に入る最大の文字数で埋める
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { remarks: Array(INVOICE_REMARKS_ROWS).fill(FULL_REMARKS_LINE).join('\n') },
        })
        await prisma.estimate.update({
            where: { id: estimate.id },
            data: { remarks: Array(ESTIMATE_REMARKS_ROWS).fill(FULL_REMARKS_LINE).join('\n') },
        })
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    for (const kind of ['estimate', 'invoice'] as const) {
        const label = kind === 'estimate' ? '見積書' : '請求書'
        it(`${label}: 外枠が5mm下がり、下端に2mmの余白があり、差引合計額と上限まで入れた備考の最終行が切れず、1ページに収まる`, async () => {
            const id = kind === 'estimate' ? estimateId : invoiceId
            await gotoAndSettle(page, `/pdf/${kind}/${id}`)
            const layout = await readLayout(page, `${kind}-pdf-content`)

            expect(layout.frameTopOffset).toBeCloseTo(BINDING_MARGIN_MM * PX_PER_MM, 0)
            expect(layout.bottomMargin, '下端の余白').toBeGreaterThanOrEqual(BOTTOM_EXTRA_MARGIN_MM * PX_PER_MM - SUBPIXEL_TOLERANCE_PX)
            expect(layout.grandTotalRoom, '差引合計額の行が外枠の中に収まる').toBeGreaterThanOrEqual(0)
            expect(layout.remarksRoom, '備考の最終行が備考欄の中に収まる').toBeGreaterThanOrEqual(0)
            expect(await pdfPageCount(session, `/api/pdf/${kind}/${id}`)).toBe(1)
        })
    }
})
