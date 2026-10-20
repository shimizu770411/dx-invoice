// 「画面の合計＝保存値＝PDFの合計」を確かめる共通の確認。
// 2026-10-14、チェックを外した固定料金の行が画面の合計にだけ残り、画面とPDFで金額がずれた。
// どの操作のあとでも、この3つが食い違わないことを毎回確認する。
// 2026-10-20、合計が3者で一致していても、入力した数量が既定値に戻っていたり、
// チェック表示と数量が食い違っていたりする不具合が続いた。そのため行ごとの状態も確かめる。
import { expect } from 'vitest'
import type { Page } from 'puppeteer-core'
import { readPdf, readSaved, pdfColumnFor, type DocKind } from './documents'
import { readAllRows, readScreenTotals, save, type RowState, type ScreenTotals } from './itemTable'
import { gotoAndSettle, type Session } from './session'

// 選ばれている行（チェックあり、または数量あり）だけを、比べやすい形にする
const selectedRows = (rows: RowState[]) => rows.filter((r) => r.checked || r.qtys.some((q) => q > 0))

// どの行も「チェックが付いている ⇔ いずれかの行に数量がある」
export function expectCheckMatchesQty(rows: RowState[], context: string): void {
    const mismatched = rows.filter((r) => r.checked !== r.qtys.some((q) => q > 0))
    expect(mismatched, `${context}: チェック表示と数量が食い違う行`).toEqual([])
}

export async function saveAndExpectConsistent(
    session: Session,
    page: Page,
    pdfPage: Page,
    kind: DocKind,
    context: string
): Promise<{ id: string; screen: ScreenTotals }> {
    const screenBeforeSave = await readScreenTotals(page)
    const rowsBeforeSave = await readAllRows(page)
    expectCheckMatchesQty(rowsBeforeSave, `${context}（保存前）`)
    const id = await save(page)
    const saved = await readSaved(session, kind, id)

    // 保存したものを開き直した画面
    await gotoAndSettle(page, `/${kind === 'estimate' ? 'estimates' : 'invoices'}/${id}`)
    const screenAfterReload = await readScreenTotals(page)
    const rowsAfterReload = await readAllRows(page)
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
    expectCheckMatchesQty(rowsAfterReload, `${context}（開き直した後）`)
    expect(selectedRows(rowsAfterReload), `${context}: 開き直した画面の、選ばれている行と数量`).toEqual(
        selectedRows(rowsBeforeSave)
    )
    return { id, screen: screenAfterReload }
}
