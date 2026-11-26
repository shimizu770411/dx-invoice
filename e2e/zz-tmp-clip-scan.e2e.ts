// 一時的な全件確認用（終わったら削除する）
import { it } from 'vitest'
import { appendFileSync, writeFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { openSession, gotoAndSettle } from './helpers/session'
const OUT = '/tmp/clip-scan.tsv'
it('scan', async () => {
    const s = await openSession(); const page = await s.newPage()
    page.setDefaultTimeout(120_000)
    const est = await prisma.estimate.findMany({ orderBy: { id: 'asc' }, select: { id: true, docNo: true, estimateType: true, customer: { select: { deceasedName: true, receptionNo: true } } } })
    const inv = await prisma.invoice.findMany({ orderBy: { id: 'asc' }, select: { id: true, docNo: true, customer: { select: { deceasedName: true, receptionNo: true } } } })
    const targets = [
        ...est.map(e => ({ kind: 'estimate', id: String(e.id), docNo: e.docNo ?? '', type: e.estimateType, name: e.customer.deceasedName, rec: e.customer.receptionNo ?? '' })),
        ...inv.map(e => ({ kind: 'invoice', id: String(e.id), docNo: e.docNo ?? '', type: '', name: e.customer.deceasedName, rec: e.customer.receptionNo ?? '' })),
    ]
    writeFileSync(OUT, `total\t${targets.length}\n`)
    let n = 0
    for (const t of targets) {
        n++
        let r: any
        try {
            await gotoAndSettle(page, `/pdf/${t.kind}/${t.id}`)
            r = await page.evaluate((id) => {
                const root = document.getElementById(id)
                if (!root) return { err: 'no-content' }
                const frame = Array.from(root.querySelectorAll('div')).find(d => d.classList.contains('border-2') && d.style.overflow === 'hidden')
                if (!frame) return { err: 'no-frame' }
                const fb = frame.getBoundingClientRect().bottom
                const gt = Array.from(frame.querySelectorAll('tr')).find(tr => (tr.textContent ?? '').replace(/\s/g, '').startsWith('差引合計額'))
                const label = Array.from(frame.querySelectorAll('div')).find(d => d.textContent === '(備考)')
                let remarksRoom: number | null = null
                const clip = label?.nextElementSibling as HTMLElement | undefined
                if (clip?.lastElementChild) {
                    const range = document.createRange(); range.selectNodeContents(clip.lastElementChild)
                    const rects = Array.from(range.getClientRects())
                    if (rects.length) remarksRoom = clip.getBoundingClientRect().bottom - Math.max(...rects.map(x => x.bottom))
                }
                return { gtRoom: gt ? fb - gt.getBoundingClientRect().bottom : null, remarksRoom }
            }, `${t.kind}-pdf-content`)
        } catch (e) { r = { err: String(e).slice(0, 80) } }
        const f = (v: any) => (typeof v === 'number' ? v.toFixed(1) : String(v))
        appendFileSync(OUT, [n, t.kind, t.id, t.type, t.docNo, t.rec, t.name, f(r.gtRoom), f(r.remarksRoom), r.err ?? ''].join('\t') + '\n')
    }
    await s.close()
}, 3_600_000)
