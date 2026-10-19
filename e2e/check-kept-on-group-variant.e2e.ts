// 重箱（種類のグループで選ぶ商品）の種類を選んでも、画面で入れたほかの商品のチェックが外れないことの通しテスト。
// 以前はチェック状態を「画面を開いた時点の数量」で全行作り直しており、重箱の種類を選ぶと、
// 開いた後にチェックを入れた御供養などのチェックが外れて見えていた（数量欄は残るが入力できなくなり、
// チェックを入れ直すと数量が既定の1に戻る）。見積・請求書で同じ明細表を使うため両方で確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { getQtys, isChecked, pickVariants, setChecked, setQty } from './helpers/itemTable'

const VARIANT_GROUP = '重箱'
const MULTI_ROW_WITH_RETURN = '御供養'
const PLAIN_PRODUCT = '控室管理費'

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('重箱の種類選択: ほかの商品のチェック（$screen）', ({ kind, screen }) => {
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

    it(`${screen}: 重箱の種類を選んでも、先にチェックした商品のチェックが外れない`, async () => {
        await openBlankDocument(session, page, kind, `重箱チェック${screen}`)
        await setChecked(page, MULTI_ROW_WITH_RETURN, true)
        await setQty(page, MULTI_ROW_WITH_RETURN, 200)
        await setChecked(page, PLAIN_PRODUCT, true)
        await setChecked(page, VARIANT_GROUP, true)
        await pickVariants(page, VARIANT_GROUP, ['Cセット'])

        expect(await isChecked(page, MULTI_ROW_WITH_RETURN), `${MULTI_ROW_WITH_RETURN} のチェックが残る`).toBe(true)
        expect((await getQtys(page, MULTI_ROW_WITH_RETURN))[0], `${MULTI_ROW_WITH_RETURN} の数量`).toBe(200)
        expect(await isChecked(page, PLAIN_PRODUCT), `${PLAIN_PRODUCT} のチェックが残る`).toBe(true)
        expect(await isChecked(page, VARIANT_GROUP), `${VARIANT_GROUP} のチェック`).toBe(true)
    })
})
