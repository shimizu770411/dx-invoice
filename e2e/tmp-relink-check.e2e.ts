// 一時確認用（読み取りのみ・保存しない）。全請求書について、保存値・画面・PDFの合計を突き合わせる。確認後に削除する
import { afterAll, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { readScreenTotals } from './helpers/itemTable'
import { pdfColumnFor, readPdf, readSaved } from './helpers/documents'

let session: Session
afterAll(async () => session?.close())

it('全請求書の合計の突き合わせ', async () => {
    assertLocalEnvironment()
    session = await openSession()
    const page = await session.newPage()
    const pdfPage = await session.newPage()
    const invoices = await prisma.invoice.findMany({ select: { id: true, docNo: true }, orderBy: { id: 'asc' } })
    const ng: string[] = []
    for (const inv of invoices) {
        const id = String(inv.id)
        try {
            const saved = await readSaved(session, 'invoice', id)
            await gotoAndSettle(page, `/invoices/${id}`)
            await new Promise((r) => setTimeout(r, 1500))
            const screen = await readScreenTotals(page)
            const pdf = pdfColumnFor(await readPdf(pdfPage, 'invoice', id), saved.isMember)
            const line = `${inv.docNo} 保存=${saved.subtotal}/${saved.total} 画面=${screen.subtotal}/${screen.total} PDF=${pdf.subtotal}/${pdf.total}`
            const ok = saved.subtotal === screen.subtotal && screen.subtotal === pdf.subtotal && saved.total === screen.total && screen.total === pdf.total
            console.log((ok ? 'OK ' : 'NG ') + line)
            if (!ok) ng.push(line)
        } catch (e: any) {
            console.log(`ERR ${inv.docNo} ${e.message}`)
            ng.push(`${inv.docNo} ERR`)
        }
    }
    console.log(`SUMMARY ${invoices.length}件中 不一致 ${ng.length}件`)
}, 1_800_000)
