// 自由行と、会員特典の固定行（満期サービス）の通しテスト。
// ・自由行も、商品の行と同じく、チェックを外して入れ直すと外す前の数量に戻る（以前は1に戻っていた）。
// ・会員の書類で満期サービスを入れたあと一般に切り替えると、以前は金額が行に出たまま合計に入らない表示になっていた。
//   今は一般に切り替えるとチェックを外し（保存もしない）、会員に戻すと入れていた金額で元どおりになる。
//   いずれも 2026-10-20 のユーザー指示による。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { readSaved } from './helpers/documents'
import { saveAndExpectConsistent } from './helpers/assertions'
import { fillFreeRow, getFreeRow, readScreenTotals, setFixedRowPrice, setMember, toggleFreeRow } from './helpers/itemTable'

const FREE_ROW = 'E2E自由'
const MATURITY = '満期サービス'

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('自由行・会員特典の固定行（$screen）', ({ kind, screen }) => {
    let session: Session
    let page: Page
    let pdfPage: Page

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        pdfPage = await session.newPage()
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it(`${screen}: 自由行のチェックを外して入れ直すと、外す前の数量に戻る`, async () => {
        await openBlankDocument(session, page, kind, `自由行入れ直し${screen}`)
        await fillFreeRow(page, { name: FREE_ROW, qty: 3, general: 2000, member: 2000 })
        const filled = await readScreenTotals(page)

        await toggleFreeRow(page, FREE_ROW)
        expect((await getFreeRow(page, FREE_ROW))?.checkbox, '外れる').toBe(false)
        await toggleFreeRow(page, FREE_ROW)
        expect((await getFreeRow(page, FREE_ROW))?.qty, '入れ直すと元の数量').toBe(3)
        expect(await readScreenTotals(page), '合計も元に戻る').toEqual(filled)
    })

    it(`${screen}: 満期サービスは一般に切り替えると外れて保存されず、会員に戻すと入れていた金額で戻る`, async () => {
        await openBlankDocument(session, page, kind, `満期サービス切替${screen}`)
        await setMember(page, true)
        const memberWithout = await readScreenTotals(page)
        await toggleFreeRow(page, MATURITY)
        await setFixedRowPrice(page, MATURITY, -20000)
        const memberWith = await readScreenTotals(page)
        expect(memberWith.subtotal, '満期サービスの分だけ小計が減る').toBe(memberWithout.subtotal - 20000)

        await setMember(page, false)
        const general = await getFreeRow(page, MATURITY)
        expect(general?.checkbox, '一般ではチェック欄を出さない').toBeNull()
        expect(general?.amountText, '一般では金額を出さない').toBe('¥0')

        await setMember(page, true)
        const back = await getFreeRow(page, MATURITY)
        expect(back?.checkbox, '会員に戻すとチェックが付く').toBe(true)
        expect(await readScreenTotals(page), '会員に戻すと合計も元どおり').toEqual(memberWith)

        await setMember(page, false)
        const { id } = await saveAndExpectConsistent(session, page, pdfPage, kind, '一般に切り替えて保存')
        const saved = await readSaved(session, kind, id)
        const maturity = (saved.raw.freeItems ?? []).filter((f: any) => f.productItemName === MATURITY && Number(f.qty) > 0)
        expect(maturity, '一般の書類には満期サービスを保存しない').toHaveLength(0)
    })
})
