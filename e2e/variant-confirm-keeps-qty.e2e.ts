// 種類を選び直して「確定」しても、入力した数量が変わらないことの通しテスト。
// 以前は確定のたびに「画面を開いた時点の数量」を見て数量を入れ直しており、
// 画面で入れた数量（御供養200など）が既定値の1に戻っていた。画面・保存値・PDFが揃って同じ数量になるため、
// 合計の一致だけを見るテストでは見つからなかった。
// あわせて、親祭壇の子商品（骨壺など）はチェックを外していても種類を選べるため、
// 選んだ時点でチェックが付き、画面の表示と合計が食い違わないことを確かめる。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { getQtys, isChecked, pickVariants, readScreenTotals, save, setChecked, setQty, setQtys } from './helpers/itemTable'
import {
    findMultiRowWithReturn,
    findParentAltar,
    findVariantGroupProduct,
    loadMaster,
    need,
    type MultiRowProduct,
    type ParentAltar,
    type VariantGroupProduct,
} from './helpers/masterLookup'

describe.each([
    { kind: 'estimate' as const, screen: '見積画面' },
    { kind: 'invoice' as const, screen: '請求書画面' },
])('種類の確定と数量（$screen）', ({ kind, screen }) => {
    let session: Session
    let page: Page
    // 役割ごとに、その時の商品マスタから探した商品（helpers/masterLookup.ts）
    let withReturn: MultiRowProduct | null = null
    let group: VariantGroupProduct | null = null
    let parent: ParentAltar | null = null

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        const master = await loadMaster(session)
        withReturn = findMultiRowWithReturn(master)
        group = findVariantGroupProduct(master)
        parent = findParentAltar(master)
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it(`${screen}: 御供養の数量・返品数を入れてから種類を選び直しても、数量がそのまま残り、保存後も同じ`, async (ctx) => {
        const product = need(ctx, withReturn?.screenRows === 2 && withReturn.otherVariant ? withReturn : null, '加算行と返品行の2行で構成され、種類が2つ以上ある商品')
        const MULTI_ROW_WITH_RETURN = product.name
        await openBlankDocument(session, page, kind, `種類確定御供養${screen}`)
        await setChecked(page, MULTI_ROW_WITH_RETURN, true)
        await setQtys(page, MULTI_ROW_WITH_RETURN, [200, 20])
        await pickVariants(page, MULTI_ROW_WITH_RETURN, [product.otherVariant!])
        expect(await getQtys(page, MULTI_ROW_WITH_RETURN), '種類確定後の数量（加算・返品）').toEqual([200, 20])

        const id = await save(page)
        await gotoAndSettle(page, `/${kind === 'estimate' ? 'estimates' : 'invoices'}/${id}`)
        expect(await isChecked(page, MULTI_ROW_WITH_RETURN), '開き直してもチェックが付いている').toBe(true)
        expect(await getQtys(page, MULTI_ROW_WITH_RETURN), '開き直した後の数量（加算・返品）').toEqual([200, 20])
    })

    // 重箱はチェックと同時に種類選択が開くため、「数量を先に入れてから初めて種類を選ぶ」操作は無い
    it(`${screen}: 重箱の種類を選んで数量を3にしてから種類を選び直しても、数量3のまま`, async (ctx) => {
        const { name: VARIANT_GROUP, baseVariant, otherVariant } = need(ctx, group, '種類をグループで選ぶ商品')
        await openBlankDocument(session, page, kind, `種類確定重箱${screen}`)
        await setChecked(page, VARIANT_GROUP, true)
        await pickVariants(page, VARIANT_GROUP, [baseVariant])
        await setQty(page, VARIANT_GROUP, 3)
        await pickVariants(page, VARIANT_GROUP, [otherVariant])
        expect((await getQtys(page, VARIANT_GROUP))[0], '種類を選び直した後の数量').toBe(3)
    })

    it(`${screen}: 親祭壇の子商品のチェックを外してから種類を選ぶと、チェックが付き合計にも入る`, async (ctx) => {
        const altar = need(ctx, parent, '子商品を持つ親祭壇')
        const child = need(ctx, altar.childWithVariants, '種類が2つ以上ある、親祭壇の子商品')
        const PARENT_ALTAR = altar.name
        const SET_CHILD = child.name
        await openBlankDocument(session, page, kind, `種類確定子商品${screen}`)
        await setChecked(page, PARENT_ALTAR, true)
        await setChecked(page, SET_CHILD, false)
        const withoutChild = await readScreenTotals(page)
        await pickVariants(page, SET_CHILD, [child.otherVariant])
        expect(await isChecked(page, SET_CHILD), `${SET_CHILD} にチェックが付く`).toBe(true)
        expect((await getQtys(page, SET_CHILD))[0], `${SET_CHILD} の数量`).toBe(1)
        // 骨壺はセット品で0円になることがあるため、合計が増えたかではなく、
        // チェックを付け直した場合と同じ合計になることで「表示と合計が揃っている」ことを見る
        const afterPick = await readScreenTotals(page)
        await setChecked(page, SET_CHILD, false)
        expect(await readScreenTotals(page), 'チェックを外すと元の合計に戻る').toEqual(withoutChild)
        await setChecked(page, SET_CHILD, true)
        await pickVariants(page, SET_CHILD, [child.otherVariant])
        expect(await readScreenTotals(page), '付け直して同じ種類を選ぶと同じ合計').toEqual(afterPick)
    })
})
