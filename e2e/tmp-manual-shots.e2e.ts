// 一時用。押印欄の作業説明書に載せる画面を撮る。見本の社員・案件を作って撮り、最後に消す。撮影後に削除する
import { afterAll, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { assertLocalEnvironment, BASE_URL } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { save, setChecked } from './helpers/itemTable'
import { findPlainProduct, loadMaster } from './helpers/masterLookup'

const OUT = '/app/.tmp-manual'
let session: Session
const userIds: bigint[] = []
let customerId: bigint | null = null

afterAll(async () => {
    await session?.close()
    if (customerId) {
        const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { estimates: { select: { id: true } }, invoices: { select: { id: true } } } })
        await prisma.operationLog.deleteMany({
            where: {
                OR: [
                    { entityType: 'ESTIMATE', entityId: { in: c?.estimates.map((e) => e.id) ?? [] } },
                    { entityType: 'INVOICE', entityId: { in: c?.invoices.map((i) => i.id) ?? [] } },
                ],
            },
        })
        await prisma.customer.delete({ where: { id: customerId } })
    }
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } })
})

// frame の要素の周り（pad）を撮る。marks の要素には赤枠を重ねる（親に隠れないよう、ページの一番上に別の枠を描く）
async function shot(page: Page, file: string, frame: () => Element | null, marks: () => Element[] = () => [], pad = 16) {
    await page.bringToFront()
    await settle(page, 400)
    const rect = await page.evaluate(
        (frameSrc: string, marksSrc: string, padPx: number) => {
            const f = new Function(`return (${frameSrc})()`)() as Element | null
            const ms = new Function(`return (${marksSrc})()`)() as Element[]
            if (!f) return null
            f.scrollIntoView({ block: 'center' })
            for (const m of ms) {
                const mr = m.getBoundingClientRect()
                const box = document.createElement('div')
                box.dataset.manualMark = '1'
                Object.assign(box.style, {
                    position: 'absolute',
                    left: `${mr.left + window.scrollX - 4}px`,
                    top: `${mr.top + window.scrollY - 4}px`,
                    width: `${mr.width + 8}px`,
                    height: `${mr.height + 8}px`,
                    border: '3px solid #e00000',
                    boxSizing: 'border-box',
                    zIndex: '99999',
                    pointerEvents: 'none',
                })
                document.body.appendChild(box)
            }
            const r = f.getBoundingClientRect()
            return { x: Math.max(0, r.left - padPx + window.scrollX), y: Math.max(0, r.top - padPx + window.scrollY), width: r.width + padPx * 2, height: r.height + padPx * 2 }
        },
        frame.toString(),
        marks.toString(),
        pad
    )
    if (!rect) throw new Error(`撮影対象が見つかりません: ${file}`)
    await page.screenshot({ path: `${OUT}/${file}.png`, clip: rect })
    await page.evaluate(() => {
        for (const m of Array.from(document.querySelectorAll('[data-manual-mark]'))) m.remove()
    })
}

async function pageAs(userId: bigint, tel: string): Promise<Page> {
    const page = await session.browser.newPage()
    await page.setViewport({ width: 1400, height: 1000 })
    await page.setCookie({ name: 'access_token', value: signToken({ sub: userId.toString(), tel }), domain: new URL(BASE_URL).hostname, path: '/' })
    page.on('dialog', (d) => void d.accept())
    return page
}

it('shots', async () => {
    assertLocalEnvironment()
    require('fs').mkdirSync(OUT, { recursive: true })
    session = await openSession()
    const seal = (await prisma.companyProfile.findFirst())?.sealImageUrl ?? null
    const admin = await prisma.user.findFirstOrThrow({ where: { isAdmin: true, isActive: true, requirePasswordChange: false }, orderBy: { id: 'asc' } })
    let telNo = 0
    const mk = async (name: string, role: string) => {
        const tel = `090-0000-${9000 + ++telNo + (Date.now() % 500)}`
        const u = await prisma.user.create({ data: { name, tel, password: 'x', role, sealImageUrl: seal } })
        userIds.push(u.id)
        return { id: u.id, tel }
    }
    const clerk = await mk('見本 事務子', 'CLERK')
    const approver = await mk('見本 決裁男', 'APPROVER')
    const staff = await mk('見本 担当郎', 'STAFF')

    // ---- 1. 印影の登録（管理者）
    const ap = await pageAs(admin.id, admin.tel)
    await gotoAndSettle(ap, '/cases')
    await ap.waitForFunction(() => Array.from(document.querySelectorAll('a, button')).some((e) => (e.textContent ?? '').replace(/s/g, '') === '社員'), { timeout: 60_000 })
    require('fs').writeFileSync(`${OUT}/debug.txt`, await ap.evaluate(() => `${location.href} header=${!!document.querySelector('header')} nav=${!!document.querySelector('nav')}`))
    await shot(
        ap,
        '01_menu_users',
        () => Array.from(document.querySelectorAll('a, button')).find((e) => (e.textContent ?? '').replace(/s/g, '') === '社員')?.closest('header, nav, div[class*="fixed"], div')?.parentElement ?? null,
        () => Array.from(document.querySelectorAll('a, button')).filter((e) => (e.textContent ?? '').replace(/\s/g, '') === '社員'),
        4
    )
    await gotoAndSettle(ap, '/users')
    await shot(
        ap,
        '02_users_edit',
        () => Array.from(document.querySelectorAll('tr')).find((tr) => (tr.textContent ?? '').includes('見本 事務子')) ?? null,
        () => {
            const tr = Array.from(document.querySelectorAll('tr')).find((t) => (t.textContent ?? '').includes('見本 事務子'))
            return Array.from(tr?.querySelectorAll('button') ?? []).filter((b) => (b.textContent ?? '').replace(/\s/g, '') === '編集')
        }
    )
    await ap.evaluate(() => {
        const tr = Array.from(document.querySelectorAll('tr')).find((t) => (t.textContent ?? '').includes('見本 事務子'))
        ;(Array.from(tr?.querySelectorAll('button') ?? []).find((b) => (b.textContent ?? '').replace(/\s/g, '') === '編集') as HTMLButtonElement)?.click()
    })
    await ap.waitForSelector('[role="dialog"]')
    await settle(ap, 1500)
    await shot(
        ap,
        '03_seal_field',
        () => Array.from(document.querySelectorAll('[role="dialog"] label')).find((l) => l.textContent?.trim() === '印影')?.parentElement ?? null,
        () => Array.from(document.querySelectorAll('[role="dialog"] label')).filter((l) => (l.textContent ?? '').includes('画像をアップロード')),
        20
    )
    await shot(
        ap,
        '04_dialog_save',
        () => document.querySelector('[role="dialog"]'),
        () => Array.from(document.querySelectorAll('[role="dialog"] button')).filter((b) => (b.textContent ?? '').replace(/\s/g, '') === '保存'),
        4
    )
    await ap.keyboard.press('Escape')

    // ---- 見本の案件・見積・請求書
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
見本の案件・見積・請求書`)
    const store = await prisma.store.findFirst({ where: { isActive: true }, orderBy: { sortNo: 'asc' } })
    const created = await session.api('POST', '/customers', {
        receptionAt: new Date().toISOString(),
        deceasedName: '見本 太郎',
        funeralFrom: '2026-11-20T01:00:00Z',
        storeId: store?.id.toString(),
    })
    customerId = BigInt(created.json.id)
    // 会員価格のある、ふつうの商品（PDFの金額が0円にならないもの）
    const master = await loadMaster(session)
    const priced = master.products.find(
        (p) =>
            findPlainProduct({ ...master, products: [p] }) === p.name &&
            Number(((p.variants ?? []).find((v: any) => v.isDefaultSet) ?? (p.variants ?? [])[0] as any)?.priceMember) > 0
    )
    const plain = priced?.name ?? findPlainProduct(master)!
    await gotoAndSettle(ap, `/estimates/new?customerId=${customerId}`)
    await setChecked(ap, plain, true)
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
before-save url=${ap.url()}`)
    const preId = await save(ap)
    const formal = await session.api('POST', `/estimates/${preId}/confirm`)
    const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formal.json.id}`)
    const invoiceId = String(invoice.json.id)

    // ---- 2. 確認ボタン（担当者でログインした画面）
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
2.確認ボタン（担当者で`)
    const sp = await pageAs(staff.id, staff.tel)
    await gotoAndSettle(sp, `/invoices/${invoiceId}`)
    const confirmRow = () => Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').startsWith('担当者確認'))?.parentElement ?? null
    await shot(sp, '05_confirm_before', confirmRow, () => Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent ?? '').startsWith('担当者確認')), 12)
    for (const [u, role] of [[staff, 'STAFF'], [clerk, 'CLERK'], [approver, 'APPROVER']] as const) {
        const token = signToken({ sub: u.id.toString(), tel: u.tel })
        await fetch(`${BASE_URL}/api/invoices/${invoiceId}/confirm`, { method: 'POST', headers: { cookie: `access_token=${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ role }) })
    }
    await gotoAndSettle(sp, `/invoices/${invoiceId}`)
    await shot(sp, '06_confirm_after', confirmRow, () => [], 12)

    // ---- 4. PDFボタン（入金前の請求書画面で撮る）
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
4.PDFボタン（入金前`)
    await gotoAndSettle(ap, `/invoices/${invoiceId}`)
    await shot(ap, '09_pdf_button', () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'PDF')?.parentElement ?? null, () => Array.from(document.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'PDF'), 24)

    // ---- 3. 入金登録（事務員でログインした画面）
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
3.入金登録（事務員でロ`)
    const cp = await pageAs(clerk.id, clerk.tel)
    await gotoAndSettle(cp, '/cases')
    await settle(cp, 1500)
    await shot(cp, '07_case_payment', () => {
        const rows = Array.from(document.querySelectorAll('button')).filter((x) => /入金登録/.test(x.textContent ?? '') && !(x as HTMLButtonElement).disabled)
        return rows[0]?.parentElement ?? null
    }, () => Array.from(document.querySelectorAll('button')).filter((x) => /入金登録/.test(x.textContent ?? '') && !(x as HTMLButtonElement).disabled).slice(0, 1), 12)
    await cp.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => /入金登録/.test(x.textContent ?? '') && !(x as HTMLButtonElement).disabled)
        ;(b as HTMLButtonElement)?.click()
    })
    await settle(cp, 800)
    // 領収書No.を入れた状態で撮る（保存はしない。撮影用の入金はこのあとAPIで入れる）
    await cp.type('input[inputmode="numeric"]', '6253108')
    await shot(
        cp,
        '08_payment_dialog',
        // 背景の案件一覧に実在の案件名が出るため、白いダイアログの枠だけを撮る
        () => {
            let el: Element | null = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '入金日') ?? null
            while (el && el.getBoundingClientRect().width < 400) el = el.parentElement
            return el
        },
        () => [
            ...Array.from(document.querySelectorAll('input[inputmode="numeric"]')),
            ...Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent ?? '').replace(/\s/g, '') === '保存'),
        ],
        12
    )
    await cp.evaluate(() => (Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').replace(/\s/g, '') === 'キャンセル') as HTMLButtonElement)?.click())
    const ct = signToken({ sub: clerk.id.toString(), tel: clerk.tel })
    await fetch(`${BASE_URL}/api/payments/invoice/${invoiceId}/paid`, { method: 'POST', headers: { cookie: `access_token=${ct}`, 'content-type': 'application/json' }, body: JSON.stringify({ paidAt: '2026-11-05', memo: '', receiptNo: '6253108' }) })

    // ---- 5. 印刷されたPDF（入金後）
    require('fs').appendFileSync(`${OUT}/debug.txt`, `
5.印刷されたPDF（入`)
    await gotoAndSettle(ap, `/pdf/invoice/${invoiceId}`)
    await ap.waitForSelector('#invoice-pdf-content tfoot')
    await settle(ap, 2000)
    const stampBox = () => {
        const remarks = Array.from(document.querySelectorAll('#invoice-pdf-content div')).find((d) => d.firstElementChild?.textContent === '(備考)')
        const tables = Array.from(remarks?.querySelectorAll('table') ?? [])
        return tables.length ? [tables[0].parentElement as Element] : []
    }
    await shot(ap, '11_pdf_whole', () => document.querySelector('#invoice-pdf-content'), stampBox, 0)
    await shot(ap, '12_pdf_stamp', () => Array.from(document.querySelectorAll('#invoice-pdf-content div')).find((d) => d.firstElementChild?.textContent === '(備考)') ?? null, stampBox, 6)
}, 600_000)
