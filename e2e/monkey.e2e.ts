// 見積・請求書画面のモンキーテスト（乱数で画面を操作し続け、壊れないかを見る）。
// 手で書いた通しテストでは思いつかない操作の順番を試すためのもの。時間がかかるので通常の通しテストでは動かさず、
// 見積・請求画面を大きく触ったときに、時間を決めて手動で流す:
//   docker exec phoenix-jpn-vercel-dev sh -lc "cd /app && MONKEY_MINUTES=15 npx vitest run -c vitest.e2e.config.mts e2e/monkey.e2e.ts"
// 乱数の種は MONKEY_SEED（省略時は 1）。落ちたときは、メッセージに出る種と操作の記録で同じ手順を再現できる。
//
// 確かめる約束:
//  ・どの操作のあとも、チェック表示と数量が食い違う行が無い（チェックあり ⇔ 数量あり）
//  ・画面でエラー（例外）が起きない
//  ・1枚ごとの最後に保存し、画面・保存値・PDFの合計と、開き直した画面の各行の状態が一致する
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { expectCheckMatchesQty, saveAndExpectConsistent } from './helpers/assertions'
import {
    clickVariantDialogButton,
    fillFreeRow,
    fillLinkedFreeRow,
    getLinkedFreeRow,
    isVariantDialogOpen,
    readAllRows,
    setChecked,
    setMember,
    toggleFreeRow,
    variantDialogText,
} from './helpers/itemTable'
import type { DocKind } from './helpers/documents'

const MINUTES = Number(process.env.MONKEY_MINUTES ?? 0)
const SEED = Number(process.env.MONKEY_SEED ?? 1)
// 1枚の書類で行う操作の数。多すぎると落ちたときに手順を追いにくい
const OPS_PER_DOCUMENT = 25
const FREE_ROW_NAME = 'モンキー自由'

function makeRandom(seed: number) {
    let a = seed >>> 0
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
    const pick = <T,>(values: readonly T[]): T => values[int(0, values.length - 1)]
    return { int, pick, bool: (p = 0.5) => next() < p }
}
type Random = ReturnType<typeof makeRandom>

// 画面に出ている商品の行と、その場で操作できるもの
type RowInfo = { name: string; checked: boolean; qtyInputs: number; enabledQtyInputs: number[]; canPickVariant: boolean }
async function readOperableRows(page: Page): Promise<RowInfo[]> {
    return page.evaluate(() => {
        const out: { name: string; checked: boolean; qtyInputs: number; enabledQtyInputs: number[]; canPickVariant: boolean }[] = []
        for (const tr of Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr'))) {
            const checkbox = tr.querySelector<HTMLInputElement>('td:first-child input[type=checkbox]')
            const tds = tr.querySelectorAll('td')
            if (!checkbox || !tds[1] || ['自由', '固定', '会員のみ'].includes(tds[2]?.textContent?.trim() ?? '')) continue
            const name = Array.from(tds[1].querySelectorAll('span'))
                .map((s) => s.textContent?.trim() ?? '')
                .find((t) => t !== '' && t !== 'セット' && t !== '親祭壇')
            if (!name) continue
            const span = Number((tr.querySelector('td') as HTMLTableCellElement).rowSpan || 1)
            const inputs: HTMLInputElement[] = []
            let cur: HTMLTableRowElement | null = tr
            for (let i = 0; i < span && cur; i++) {
                const input = cur.querySelector<HTMLInputElement>('input[type=number]')
                if (input) inputs.push(input)
                cur = cur.nextElementSibling as HTMLTableRowElement | null
            }
            const opener = Array.from(tr.querySelectorAll('button')).find((b) => b.textContent?.includes('feature_search'))
            out.push({
                name,
                checked: checkbox.checked,
                qtyInputs: inputs.length,
                enabledQtyInputs: inputs.map((input, k) => (input.disabled ? -1 : k)).filter((k) => k >= 0),
                canPickVariant: !!opener && !(opener as HTMLButtonElement).disabled,
            })
        }
        return out
    })
}

// 商品の行の k 行目の数量欄に値を入れる
async function typeQty(page: Page, name: string, k: number, qty: number): Promise<void> {
    const handle = await page.evaluateHandle(
        (target: string, offset: number) => {
            const tr = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr')).find((r) =>
                Array.from(r.querySelectorAll('td')[1]?.querySelectorAll('span') ?? []).some((s) => s.textContent?.trim() === target)
            )
            let cur: Element | null = tr ?? null
            for (let i = 0; i < offset && cur; i++) cur = cur.nextElementSibling
            return cur?.querySelector('input[type=number]') ?? null
        },
        name,
        k
    )
    const input = handle.asElement()
    if (!input) return
    await (input as any).click({ clickCount: 3 })
    await page.keyboard.type(String(qty))
    await page.keyboard.press('Tab')
    await settle(page, 400)
}

// 開いている種類選択で、種類のボタンを乱数で押してから閉じる。
// 選ばずに閉じようとして注意が出たら、選び直すかチェックを外すかも乱数で決める
async function playVariantDialog(page: Page, r: Random, log: string[]): Promise<void> {
    for (let attempt = 0; attempt < 3 && (await isVariantDialogOpen(page)); attempt++) {
        const labels: string[] = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[role=dialog] button'))
                .map((b) => (b.textContent ?? '').trim())
                .filter((t) => t !== '' && !['キャンセル', '確定', 'チェックを外す', 'Close'].includes(t))
        )
        const clicks = r.int(0, 2)
        for (let c = 0; c < clicks && labels.length > 0; c++) {
            const label = r.pick(labels)
            log.push(`  種類選択で「${label.slice(0, 20)}」を押す`)
            await page.evaluate((text: string) => {
                const b = Array.from(document.querySelectorAll('[role=dialog] button')).find((x) => (x.textContent ?? '').trim() === text)
                ;(b as HTMLButtonElement | undefined)?.click()
            }, label)
            await settle(page, 200)
        }
        const text = await variantDialogText(page)
        const confirmEnabled: boolean = await page.evaluate(() => {
            const b = Array.from(document.querySelectorAll('[role=dialog] button')).find((x) => x.textContent?.trim() === '確定')
            return !!b && !(b as HTMLButtonElement).disabled
        })
        if (text.includes('種類が選択されていません') && r.bool(0.5)) {
            log.push('  注意が出たので「チェックを外す」')
            await clickVariantDialogButton(page, 'チェックを外す')
        } else if (confirmEnabled && r.bool(0.8)) {
            log.push('  「確定」')
            await clickVariantDialogButton(page, '確定')
        } else {
            log.push('  「キャンセル」')
            await clickVariantDialogButton(page, 'キャンセル').catch(() => undefined)
        }
    }
    // それでも開いていれば、確実に閉じる（以降の操作が邪魔されないように）
    if (await isVariantDialogOpen(page)) {
        const text = await variantDialogText(page)
        await clickVariantDialogButton(page, text.includes('種類が選択されていません') ? 'チェックを外す' : 'キャンセル').catch(() => undefined)
    }
}

async function openVariantDialogOf(page: Page, name: string): Promise<void> {
    await page.evaluate((target: string) => {
        const tr = Array.from(document.querySelectorAll('table tbody tr')).find((r) =>
            Array.from(r.querySelectorAll('td')[1]?.querySelectorAll('span') ?? []).some((s) => s.textContent?.trim() === target)
        )
        const opener = Array.from(tr?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('feature_search'))
        ;(opener as HTMLButtonElement | undefined)?.click()
    }, name)
    await settle(page, 300)
}

async function changePlan(page: Page, planNames: string[], r: Random, log: string[]): Promise<void> {
    const name = r.pick(planNames)
    const select = await page.evaluateHandle(
        (names: string[]) =>
            Array.from(document.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => names.includes(o.textContent?.trim() ?? ''))) ?? null,
        planNames
    )
    const el = select.asElement() as any
    if (!el) return
    const value = await el.evaluate((s: HTMLSelectElement, n: string) => Array.from(s.options).find((o) => o.textContent?.trim() === n)?.value, name)
    if (!value) return
    log.push(`プランを「${name}」にする`)
    // 明細が消える場合の確認は、セッション共通の設定で「OK」になる
    await el.select(value)
    await settle(page, 1500)
}

// 1手分の乱数操作
async function randomOperation(page: Page, kind: DocKind, r: Random, planNames: string[], log: string[]): Promise<void> {
    const rows = await readOperableRows(page)
    const op = r.pick(['toggle', 'toggle', 'toggle', 'qty', 'qty', 'variant', 'free', 'fixed', 'linked', 'member', 'plan'] as const)
    if (op === 'toggle' && rows.length > 0) {
        const row = r.pick(rows)
        log.push(`「${row.name}」のチェックを${row.checked ? '外す' : '付ける'}`)
        await setChecked(page, row.name, !row.checked)
        if (await isVariantDialogOpen(page)) await playVariantDialog(page, r, log)
        return
    }
    if (op === 'qty') {
        const candidates = rows.filter((row) => row.enabledQtyInputs.length > 0)
        if (candidates.length === 0) return
        const row = r.pick(candidates)
        const k = r.pick(row.enabledQtyInputs)
        const qty = r.pick([0, 1, 2, 3, 5, 200])
        log.push(`「${row.name}」の${k + 1}行目の数量を ${qty} にする`)
        await typeQty(page, row.name, k, qty)
        return
    }
    if (op === 'variant') {
        const candidates = rows.filter((row) => row.canPickVariant)
        if (candidates.length === 0) return
        const row = r.pick(candidates)
        log.push(`「${row.name}」の種類選択を開く`)
        await openVariantDialogOf(page, row.name)
        await playVariantDialog(page, r, log)
        return
    }
    if (op === 'free') {
        if (r.bool(0.5)) {
            const qty = r.pick([1, 2, 3])
            const general = r.pick([1000, 5000, -2000])
            log.push(`自由行「${FREE_ROW_NAME}」に 数量${qty}・一般${general} を入れる`)
            await fillFreeRow(page, { name: FREE_ROW_NAME, qty, general, member: general })
        } else {
            log.push(`自由行「${FREE_ROW_NAME}」のチェックを付け外し`)
            await toggleFreeRow(page, FREE_ROW_NAME).catch(() => undefined)
        }
        return
    }
    if (op === 'fixed') {
        // 満期サービス・施行割増券（会員の書類でだけチェック欄が出る）
        const name = r.pick(['満期サービス', '施行割増券'])
        log.push(`固定行「${name}」のチェックを付け外し`)
        await toggleFreeRow(page, name).catch(() => undefined)
        return
    }
    if (op === 'linked') {
        const parents = rows.filter((row) => row.checked)
        for (const parent of parents) {
            if (!(await getLinkedFreeRow(page, parent.name))) continue
            const qty = r.pick([1, 2])
            log.push(`「${parent.name}」の追加行に 数量${qty} を入れる`)
            await fillLinkedFreeRow(page, parent.name, { name: 'モンキー追加', qty, general: 3000, member: 2500 })
            return
        }
        return
    }
    if (op === 'member') {
        const toMember = r.bool(0.5)
        log.push(`${toMember ? '会員' : '一般'}に切り替える`)
        await setMember(page, toMember)
        return
    }
    if (op === 'plan' && kind === 'estimate') {
        await changePlan(page, planNames, r, log)
    }
}

describe.skipIf(!MINUTES)(`見積・請求書画面のモンキーテスト（${MINUTES}分・種 ${SEED}）`, () => {
    let session: Session
    let page: Page
    let pdfPage: Page
    const pageErrors: string[] = []

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        pdfPage = await session.newPage()
        page.on('pageerror', (err) => pageErrors.push(String((err as Error)?.message ?? err)))
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it(
        '乱数で操作を続けても、チェック表示と数量が食い違わず、保存すると画面・保存値・PDFが一致する',
        async () => {
            const r = makeRandom(SEED)
            const plans = await prisma.plan.findMany({ where: { isActive: true }, select: { name: true } })
            const planNames = plans.map((p) => p.name)
            const deadline = Date.now() + MINUTES * 60_000
            let documents = 0
            let operations = 0
            // 見つかった不具合。決めた時間を使い切るため、見つけても止めずに次の書類へ進み、最後にまとめて報告する
            const failures: string[] = []
            while (Date.now() < deadline) {
                const kind: DocKind = documents % 2 === 0 ? 'estimate' : 'invoice'
                const log: string[] = [`--- ${documents + 1} 枚目（${kind === 'estimate' ? '見積' : '請求書'}）---`]
                try {
                    await openBlankDocument(session, page, kind, `モンキー${documents + 1}`)
                    for (let n = 0; n < OPS_PER_DOCUMENT && Date.now() < deadline; n++) {
                        await randomOperation(page, kind, r, planNames, log)
                        operations++
                        expect(pageErrors, '画面でエラーが起きた').toEqual([])
                        expectCheckMatchesQty(await readAllRows(page), `${n + 1} 手目のあと`)
                    }
                    const rows = await readAllRows(page)
                    if (rows.some((row) => row.qtys.some((q) => q > 0))) {
                        log.push('保存して、画面・保存値・PDF・開き直した画面を照合')
                        await saveAndExpectConsistent(session, page, pdfPage, kind, `${documents + 1} 枚目の保存`)
                    }
                } catch (error) {
                    failures.push(`${(error as Error).message}\n\n操作の記録:\n${log.join('\n')}`)
                    // 次の書類に持ち越さない
                    pageErrors.length = 0
                }
                documents++
                // テスト用の案件は1枚ごとに片付ける（長時間流すとたまるため）
                await cleanupTestCases()
            }
            console.log(`モンキーテスト: 種 ${SEED}、${documents} 枚・${operations} 手を操作、不具合 ${failures.length} 件`)
            expect(failures, `種 ${SEED} で見つかった不具合:\n\n${failures.join('\n\n==========\n\n')}`).toEqual([])
        },
        MINUTES * 60_000 + 10 * 60_000
    )
})
