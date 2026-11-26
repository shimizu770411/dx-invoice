// 一時的な全件確認用（終わったら削除する）
import { it } from 'vitest'
import { appendFileSync, writeFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { BASE_URL } from './helpers/env'
import { openSession } from './helpers/session'
const OUT = '/tmp/page-scan.tsv'
it('scan', async () => {
    const s = await openSession()
    const est = await prisma.estimate.findMany({ orderBy: { id: 'asc' }, select: { id: true, docNo: true, customer: { select: { deceasedName: true, receptionNo: true } } } })
    const inv = await prisma.invoice.findMany({ orderBy: { id: 'asc' }, select: { id: true, docNo: true, customer: { select: { deceasedName: true, receptionNo: true } } } })
    const targets = [...est.map(e => ({ kind: 'estimate', ...e })), ...inv.map(e => ({ kind: 'invoice', ...e }))]
    writeFileSync(OUT, `total\t${targets.length}\n`)
    let n = 0
    for (const t of targets) {
        n++
        let pages = -1, err = ''
        try {
            const res = await fetch(`${BASE_URL}/api/pdf/${t.kind}/${t.id}?showOptions=false`, { headers: { cookie: `access_token=${s.token}` } })
            if (res.status !== 200) err = `HTTP ${res.status}`
            else pages = (Buffer.from(await res.arrayBuffer()).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
        } catch (e) { err = String(e).slice(0, 80) }
        appendFileSync(OUT, [n, t.kind, String(t.id), t.docNo ?? '', t.customer.receptionNo ?? '', t.customer.deceasedName, pages, err].join('\t') + '\n')
    }
    await s.close()
}, 7_200_000)
