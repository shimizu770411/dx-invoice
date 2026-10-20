// チェックの外し・入れ直しの通しテスト。
// ・入れ直したときは、外す前に入力していた数量（返品数・追加行・親祭壇の子商品を含む）に戻る。
//   以前は入れ直すと既定の数量（1）に戻り、入力し直しが必要だった（2026-10-20 ユーザー指示で保持に変更）。
// ・チェック表示は数量と常に一致する（チェックあり ⇔ 数量あり）。
//   以前はチェック表示を数量とは別に持っていたため、数量を0にしてもチェックが付いたまま残るなどの食い違いがあった。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { expectCheckMatchesQty, saveAndExpectConsistent } from './helpers/assertions'
import {
    fillLinkedFreeRow,
    getLinkedFreeRow,
    getQtys,
    isChecked,
    readAllRows,
    setChecked,
    setQty,
    setQtys,
} from './helpers/itemTable'

const MULTI_ROW_WITH_RETURN = '御供養'
const WITH_LINKED_FREE_ROW = '控室管理費'
const PARENT_ALTAR = '式場祭壇'
const SET_CHILD = '棺'

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('チェックの外し・入れ直し（$screen）', ({ kind, screen }) => {
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

    it(`${screen}: 御供養の数量・返品数を入れてから外して入れ直すと、入れていた数量に戻る`, async () => {
        await openBlankDocument(session, page, kind, `入れ直し御供養${screen}`)
        await setChecked(page, MULTI_ROW_WITH_RETURN, true)
        await setQtys(page, MULTI_ROW_WITH_RETURN, [200, 20])

        await setChecked(page, MULTI_ROW_WITH_RETURN, false)
        expect(await getQtys(page, MULTI_ROW_WITH_RETURN), '外すと全行0').toEqual([0, 0])
        await setChecked(page, MULTI_ROW_WITH_RETURN, true)
        expect(await getQtys(page, MULTI_ROW_WITH_RETURN), '入れ直すと元の数量').toEqual([200, 20])

        await saveAndExpectConsistent(session, page, pdfPage, kind, '御供養を入れ直した後')
    })

    it(`${screen}: 追加行を持つ商品の数量と追加行を入れてから外して入れ直すと、どちらも元に戻る`, async () => {
        await openBlankDocument(session, page, kind, `入れ直し追加行${screen}`)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        await setQty(page, WITH_LINKED_FREE_ROW, 3)
        await fillLinkedFreeRow(page, WITH_LINKED_FREE_ROW, { name: 'E2E追加', qty: 2, general: 5000, member: 4000 })

        await setChecked(page, WITH_LINKED_FREE_ROW, false)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        expect((await getQtys(page, WITH_LINKED_FREE_ROW))[0], '商品の数量').toBe(3)
        expect((await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW))?.qty, '追加行の数量').toBe(2)

        await saveAndExpectConsistent(session, page, pdfPage, kind, '追加行を持つ商品を入れ直した後')
    })

    it(`${screen}: 親祭壇を外して入れ直すと、子商品も入れていた数量に戻る`, async () => {
        await openBlankDocument(session, page, kind, `入れ直し親祭壇${screen}`)
        await setChecked(page, PARENT_ALTAR, true)
        await setQty(page, SET_CHILD, 2)

        await setChecked(page, PARENT_ALTAR, false)
        await setChecked(page, PARENT_ALTAR, true)
        expect(await isChecked(page, SET_CHILD), `${SET_CHILD} にチェック`).toBe(true)
        expect((await getQtys(page, SET_CHILD))[0], `${SET_CHILD} の数量`).toBe(2)

        await saveAndExpectConsistent(session, page, pdfPage, kind, '親祭壇を入れ直した後')
    })

    it(`${screen}: 数量を0にするとチェックが外れ、未チェックの商品に数量を入れるとチェックが付く`, async () => {
        await openBlankDocument(session, page, kind, `数量とチェック${screen}`)
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        await setQty(page, WITH_LINKED_FREE_ROW, 0)
        expect(await isChecked(page, WITH_LINKED_FREE_ROW), '数量0でチェックが外れる').toBe(false)
        expectCheckMatchesQty(await readAllRows(page), '数量を0にした後')

        await setQty(page, WITH_LINKED_FREE_ROW, 4)
        expect(await isChecked(page, WITH_LINKED_FREE_ROW), '数量を入れるとチェックが付く').toBe(true)
        expectCheckMatchesQty(await readAllRows(page), '数量を入れた後')

        await saveAndExpectConsistent(session, page, pdfPage, kind, '数量の入力でチェックを付けた後')
    })
})
