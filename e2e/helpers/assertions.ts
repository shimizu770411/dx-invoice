// 「画面の合計＝保存値＝PDFの合計」を確かめる共通の確認。
// 2026-10-14、チェックを外した固定料金の行が画面の合計にだけ残り、画面とPDFで金額がずれた。
// どの操作のあとでも、この3つが食い違わないことを毎回確認する。
import { expect } from 'vitest'
import type { Page } from 'puppeteer-core'
import { readPdf, readSaved, pdfColumnFor, type DocKind } from './documents'
import { readScreenTotals, save, type ScreenTotals } from './itemTable'
import { gotoAndSettle, type Session } from './session'

export async function saveAndExpectConsistent(
    session: Session,
    page: Page,
    pdfPage: Page,
    kind: DocKind,
    context: string
): Promise<{ id: string; screen: ScreenTotals }> {
    const screenBeforeSave = await readScreenTotals(page)
    const id = await save(page)
    const saved = await readSaved(session, kind, id)

    // 保存したものを開き直した画面
    await gotoAndSettle(page, `/${kind === 'estimate' ? 'estimates' : 'invoices'}/${id}`)
    const screenAfterReload = await readScreenTotals(page)
    const pdf = pdfColumnFor(await readPdf(pdfPage, kind, id), saved.isMember)
    // 続きの操作は編集画面で行うので、編集画面のタブを前に戻す
    await page.bringToFront()

    const pick = (t: { subtotal: number; tax: number; total: number; grandTotal: number }) => ({
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        grandTotal: t.grandTotal,
    })
    const expected = pick(saved)
    expect(pick(screenBeforeSave), `${context}: 保存前の画面の合計と保存値`).toEqual(expected)
    expect(pick(screenAfterReload), `${context}: 開き直した画面の合計と保存値`).toEqual(expected)
    expect(pick(pdf), `${context}: PDFの合計と保存値`).toEqual(expected)
    return { id, screen: screenAfterReload }
}
