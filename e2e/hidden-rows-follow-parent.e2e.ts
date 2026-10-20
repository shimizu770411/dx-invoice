// 親になる商品の数量を手で0にしたときの、子商品・追加行の扱いの通しテスト。
// ・控室管理費の数量を0にすると追加行は画面から消えるが、以前は合計と保存には残っていた
//   （どこにも行として出ない金額が合計に入る）。今は親が選ばれていない追加行は合計にも保存にも入れない。
// ・親祭壇の数量を0にすると子商品は画面から消える。以前は消えた子商品の数量を裏で0にしていたため、
//   親の数量を戻すと子商品が数量0で出てきた。今は子商品の数量を残し（合計・保存には入れない）、親を戻せば元どおりに出す。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { readSaved } from './helpers/documents'
import { expectCheckMatchesQty, saveAndExpectConsistent } from './helpers/assertions'
import {
    fillLinkedFreeRow,
    getLinkedFreeRow,
    readAllRows,
    readScreenTotals,
    setChecked,
    setQty,
} from './helpers/itemTable'

const WITH_LINKED_FREE_ROW = '控室管理費'
const PARENT_ALTAR = '式場祭壇'
const selected = (rows: Awaited<ReturnType<typeof readAllRows>>) =>
    rows.filter((r) => r.checked || r.qtys.some((q) => q > 0))

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('親の数量を0にしたときの子商品・追加行（$screen）', ({ kind, screen }) => {
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

    it(`${screen}: 控室管理費の数量を0にすると、追加行は合計にも保存にも入らない`, async () => {
        await openBlankDocument(session, page, kind, `追加行と親の数量${screen}`)
        const withoutParent = await readScreenTotals(page)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        await fillLinkedFreeRow(page, WITH_LINKED_FREE_ROW, { name: 'E2E追加', qty: 2, general: 5000, member: 4000 })

        await setQty(page, WITH_LINKED_FREE_ROW, 0)
        expect(await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW), '追加行は表示されない').toBeNull()
        expect(await readScreenTotals(page), '合計は控室管理費を入れる前と同じ').toEqual(withoutParent)
        const { id } = await saveAndExpectConsistent(session, page, pdfPage, kind, '親の数量を0にした後')
        const saved = await readSaved(session, kind, id)
        const remaining = (saved.raw.freeItems ?? []).filter((f: any) => f.productItemName === 'E2E追加' && Number(f.qty) > 0)
        expect(remaining, '追加行は保存されない').toHaveLength(0)
    })

    it(`${screen}: 控室管理費の数量を0にしてから戻すと、追加行が元の内容で戻る`, async () => {
        await openBlankDocument(session, page, kind, `追加行の戻り${screen}`)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        await fillLinkedFreeRow(page, WITH_LINKED_FREE_ROW, { name: 'E2E追加', qty: 2, general: 5000, member: 4000 })
        const withLinkedRow = await readScreenTotals(page)

        await setQty(page, WITH_LINKED_FREE_ROW, 0)
        await setQty(page, WITH_LINKED_FREE_ROW, 1)
        expect((await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW))?.qty, '追加行の数量').toBe(2)
        expect(await readScreenTotals(page), '合計が元に戻る').toEqual(withLinkedRow)
    })

    it(`${screen}: 親祭壇の数量を0にして戻すと、子商品が元の数量で戻り、0の間は合計に入らない`, async () => {
        await openBlankDocument(session, page, kind, `親祭壇の数量${screen}`)
        const withoutAltar = await readScreenTotals(page)
        await setChecked(page, PARENT_ALTAR, true)
        const rowsWithAltar = selected(await readAllRows(page))
        const totalsWithAltar = await readScreenTotals(page)

        await setQty(page, PARENT_ALTAR, 0)
        expect(await readScreenTotals(page), '親祭壇0の間は、祭壇を入れる前の合計').toEqual(withoutAltar)
        expectCheckMatchesQty(await readAllRows(page), '親祭壇を0にした後')

        await setQty(page, PARENT_ALTAR, 1)
        expect(selected(await readAllRows(page)), '子商品が元の数量で戻る').toEqual(rowsWithAltar)
        expect(await readScreenTotals(page), '合計も元に戻る').toEqual(totalsWithAltar)
        await saveAndExpectConsistent(session, page, pdfPage, kind, '親祭壇の数量を戻した後')
    })
})
