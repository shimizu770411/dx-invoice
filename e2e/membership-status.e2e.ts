// 会員タブ（互助会員１・２、けやき）の「状況」「完納日」の通しテスト。
// 画面で「完納」と完納日を入れて更新→再表示で残ること、
// 「保留」に切り替えると完納日が入力できなくなり、保存値からも消えることを確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'

const TABS = [
    { label: '互助会員１', rowNo: 1 },
    { label: '互助会員２', rowNo: 2 },
    { label: 'けやき', rowNo: 3 },
]

async function clickByText(page: Page, selector: string, text: string) {
    const clicked = await page.evaluate(
        (selector, text) => {
            const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
                (e) => e.textContent?.trim() === text && e.offsetParent !== null
            )
            el?.click()
            return !!el
        },
        selector,
        text
    )
    if (!clicked) throw new Error(`E2E: 「${text}」が見つかりません (${selector})`)
    await settle(page, 300)
}

// 項目名のすぐ下の入力欄（クリックで開く部分）を押す
async function clickFieldOf(page: Page, label: string) {
    const clicked = await page.evaluate((label) => {
        const l = Array.from(document.querySelectorAll<HTMLElement>('label.brand-label')).find(
            (e) => e.textContent?.trim() === label && e.offsetParent !== null
        )
        const field = l?.nextElementSibling as HTMLElement | null
        field?.click()
        return !!field
    }, label)
    if (!clicked) throw new Error(`E2E: 項目「${label}」が見つかりません`)
    await settle(page, 300)
}

// 項目名のすぐ下の入力欄の表示文字と、入力不可かどうか
function fieldState(page: Page, label: string) {
    return page.evaluate((label) => {
        const l = Array.from(document.querySelectorAll<HTMLElement>('label.brand-label')).find(
            (e) => e.textContent?.trim() === label && e.offsetParent !== null
        )
        const field = l?.nextElementSibling as HTMLElement | null
        // 矢印などのアイコン（material-symbols の文字）は除いて、表示中の値だけを見る
        const valueSpan = field?.querySelector<HTMLElement>('span:not(.material-symbols-outlined)')
        return {
            text: valueSpan?.textContent?.trim() ?? '',
            disabled: !!field && (field.className.includes('cursor-not-allowed') || field.style.cursor === 'not-allowed'),
        }
    }, label)
}

// 開いている日付選択で西暦の年月日を選んで確定する
async function pickWesternDate(page: Page, y: number, m: number, d: number) {
    await clickByText(page, 'button', '西暦で入力')
    const selects = await page.$$('[data-radix-popper-content-wrapper] select')
    await selects[0].select(String(y))
    await selects[1].select(String(m))
    await selects[2].select(String(d))
    await settle(page, 200)
    await clickByText(page, 'button', '確定')
}

async function openTab(page: Page, customerId: string, tabLabel: string) {
    await gotoAndSettle(page, `/cases/${customerId}`)
    await clickByText(page, 'button', tabLabel)
}

async function submitUpdate(page: Page) {
    await clickByText(page, 'button[type="submit"]', '更　新')
    await page.waitForFunction(() => !document.body.textContent?.includes('更新しています'), { timeout: 60_000 })
    await settle(page, 1000)
}

const membershipRow = (customerId: string, rowNo: number) =>
    prisma.customerMembership.findFirst({ where: { customerId: BigInt(customerId), rowNo } })

describe('会員タブの状況・完納日', () => {
    let session: Session
    let page: Page
    let customerId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        customerId = await createTestCase(session, '会員状況')
        // 行年は画面の更新で必須。テスト用の案件には入っていないので補っておく
        await prisma.customer.update({ where: { id: BigInt(customerId) }, data: { age: 80 } })
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    for (const tab of TABS) {
        it(`${tab.label}: 未設定の間は完納日を入力できない`, async () => {
            await openTab(page, customerId, tab.label)
            expect((await fieldState(page, '状況')).text).toBe('選択してください')
            expect((await fieldState(page, '完納日')).disabled).toBe(true)
        })

        it(`${tab.label}: 完納と完納日を入れて更新すると、保存され再表示でも残る`, async () => {
            await openTab(page, customerId, tab.label)
            await clickFieldOf(page, '状況')
            await clickByText(page, 'div', '完納')
            expect((await fieldState(page, '完納日')).disabled).toBe(false)
            await clickFieldOf(page, '完納日')
            await pickWesternDate(page, 2025, 3, 15)
            await submitUpdate(page)

            const row = await membershipRow(customerId, tab.rowNo)
            expect(row?.status).toBe('COMPLETED')
            expect(row?.completedAt?.toISOString().slice(0, 10)).toBe('2025-03-15')

            await openTab(page, customerId, tab.label)
            expect((await fieldState(page, '状況')).text).toBe('完納')
            expect((await fieldState(page, '完納日')).text).toContain('2025')
        })

        it(`${tab.label}: 保留に切り替えると完納日が消え、保存値からも消える`, async () => {
            await openTab(page, customerId, tab.label)
            await clickFieldOf(page, '状況')
            await clickByText(page, 'div', '保留')
            const completed = await fieldState(page, '完納日')
            expect(completed.disabled).toBe(true)
            expect(completed.text).toBe('日付を選択')
            await submitUpdate(page)

            const row = await membershipRow(customerId, tab.rowNo)
            expect(row?.status).toBe('ON_HOLD')
            expect(row?.completedAt).toBeNull()
        })
    }

    it('他の会員行の値は巻き込まれない（最後の保存後も3行とも保留）', async () => {
        const rows = await prisma.customerMembership.findMany({ where: { customerId: BigInt(customerId) }, orderBy: { rowNo: 'asc' } })
        expect(rows.map((r) => [r.rowNo, r.status, r.completedAt])).toEqual([
            [1, 'ON_HOLD', null],
            [2, 'ON_HOLD', null],
            [3, 'ON_HOLD', null],
        ])
    })
})
