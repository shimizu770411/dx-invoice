// 重箱（種類のグループで選ぶ商品）は、種類を選ばないままチェックだけ付いた状態で残らないことの通しテスト。
// 以前はチェックだけ付けて保存できてしまい、0円・種類なしの明細が書類に残っていた。
// 今は、チェックと同時に種類選択が開き、種類を選ばずに閉じようとすると注意が出る。
// それでも選ばなければチェックを外す。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import {
    clickVariantDialogButton,
    getQtys,
    isChecked,
    isVariantDialogOpen,
    pickVariants,
    readScreenTotals,
    setChecked,
    variantDialogText,
} from './helpers/itemTable'

const VARIANT_GROUP = '重箱'
const WARNING = '種類が選択されていません'

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('重箱の種類未選択（$screen）', ({ kind, screen }) => {
    let session: Session
    let page: Page

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it(`${screen}: チェックすると種類選択が開き、選ばずに閉じようとすると注意が出て、そのまま外すとチェックが外れる`, async () => {
        await openBlankDocument(session, page, kind, `重箱未選択${screen}`)
        const before = await readScreenTotals(page)

        await setChecked(page, VARIANT_GROUP, true)
        expect(await isVariantDialogOpen(page), 'チェックと同時に種類選択が開く').toBe(true)
        expect(await variantDialogText(page), '開いた直後は注意を出さない').not.toContain(WARNING)

        await clickVariantDialogButton(page, 'キャンセル')
        expect(await isVariantDialogOpen(page), '種類を選ばずには閉じない').toBe(true)
        expect(await variantDialogText(page), '注意が出る').toContain(WARNING)

        await clickVariantDialogButton(page, 'チェックを外す')
        expect(await isVariantDialogOpen(page), '「チェックを外す」で閉じる').toBe(false)
        expect(await isChecked(page, VARIANT_GROUP), '重箱のチェックが外れる').toBe(false)
        expect((await getQtys(page, VARIANT_GROUP))[0], '重箱の数量').toBe(0)
        expect(await readScreenTotals(page), '合計は元のまま').toEqual(before)
    })

    it(`${screen}: 注意が出たあとに種類を選んで確定すれば、チェックが付いたまま`, async () => {
        await openBlankDocument(session, page, kind, `重箱注意後選択${screen}`)
        await setChecked(page, VARIANT_GROUP, true)
        await clickVariantDialogButton(page, 'キャンセル')
        expect(await variantDialogText(page), '注意が出る').toContain(WARNING)

        await pickVariants(page, VARIANT_GROUP, ['Cセット'])
        expect(await isVariantDialogOpen(page), '確定で閉じる').toBe(false)
        expect(await isChecked(page, VARIANT_GROUP), '重箱にチェックが付いている').toBe(true)
        expect((await getQtys(page, VARIANT_GROUP))[0], '重箱の数量').toBe(1)
    })

    it(`${screen}: 種類を選んである重箱は、種類選択を開いてキャンセルしてもそのまま閉じる`, async () => {
        await openBlankDocument(session, page, kind, `重箱選択済み${screen}`)
        await setChecked(page, VARIANT_GROUP, true)
        await pickVariants(page, VARIANT_GROUP, ['Cセット'])
        await page.evaluate((name: string) => {
            const row = Array.from(document.querySelectorAll('table tbody tr')).find((tr) =>
                Array.from(tr.querySelectorAll('td')[1]?.querySelectorAll('span') ?? []).some((s) => s.textContent?.trim() === name)
            )
            const opener = Array.from(row?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('feature_search'))
            ;(opener as HTMLButtonElement | undefined)?.click()
        }, VARIANT_GROUP)
        await page.waitForSelector('[role=dialog]')
        await clickVariantDialogButton(page, 'キャンセル')
        expect(await isVariantDialogOpen(page), 'キャンセルで閉じる').toBe(false)
        expect(await isChecked(page, VARIANT_GROUP), '重箱にチェックが付いたまま').toBe(true)
    })
})
