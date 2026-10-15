// 保存値（見積・請求書の取得API）と、PDFページに印字される合計を読む窓口。
import type { Page } from 'puppeteer-core'
import { gotoAndSettle, type Session } from './session'

export type DocKind = 'estimate' | 'invoice'
export type DocTotals = { subtotal: number; tax: number; total: number; grandTotal: number }

export async function readSaved(session: Session, kind: DocKind, id: string): Promise<DocTotals & { isMember: boolean; docNo: string | null; raw: any }> {
    const res = await session.api('GET', `/${kind === 'estimate' ? 'estimates' : 'invoices'}/${id}`)
    if (res.status !== 200) throw new Error(`E2E: ${kind} ${id} を取得できません (${res.status})`)
    const d = res.json
    return {
        subtotal: Number(d.subtotal),
        tax: Number(d.tax),
        total: Number(d.total),
        grandTotal: Number(d.grandTotal),
        isMember: d.isMember === true,
        docNo: d.docNo ?? null,
        raw: d,
    }
}

export type PdfTotals = { headers: string[]; general: DocTotals; member: DocTotals | null }

// PDFページ（印刷用の画面）の明細表の合計欄。一般価格列と、あれば会員価格列
export async function readPdf(page: Page, kind: DocKind, id: string): Promise<PdfTotals> {
    await gotoAndSettle(page, `/pdf/${kind}/${id}`)
    const contentId = `#${kind}-pdf-content`
    await page.waitForSelector(`${contentId} tfoot`)
    return page.evaluate((sel: string) => {
        const num = (t: string | null | undefined) => Number((t ?? '').replace(/[^\d-]/g, '') || '0')
        const table = document.querySelector(`${sel} tfoot`)!.closest('table')!
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').replace(/\s/g, ''))
        const rowFor = (label: string) =>
            Array.from(table.querySelectorAll('tfoot tr')).find(
                (tr) => (tr.querySelector('th')?.textContent ?? '').replace(/\s/g, '') === label
            )
        const values = (label: string) => Array.from(rowFor(label)?.querySelectorAll('td') ?? []).slice(1).map((td) => num(td.textContent))
        const [sub, tax, total, grand] = ['小計', '消費税10%', '合計', '差引合計額'].map(values)
        const hasMember = headers.includes('会員価格')
        const pick = (i: number) => ({ subtotal: sub[i] ?? 0, tax: tax[i] ?? 0, total: total[i] ?? 0, grandTotal: grand[i] ?? 0 })
        return { headers, general: pick(0), member: hasMember ? pick(1) : null }
    }, contentId)
}

// 書類の区分（一般・会員）に対応するPDFの合計列
export function pdfColumnFor(pdf: PdfTotals, isMember: boolean): DocTotals {
    if (isMember) {
        if (!pdf.member) throw new Error('E2E: 会員の書類なのにPDFに会員価格列がありません')
        return pdf.member
    }
    return pdf.general
}
