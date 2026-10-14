// 見積画面のチェックの付け外しの通しテスト。
// 明細表の連動処理（親祭壇→子のセット商品、複数行で1商品の一括、追加行の数量0化など）は
// 画面部品の中に直接書かれていて単体テストが無いため、実際の画面を操作して確かめる。
// 各場面の最後に「画面の合計＝保存値＝PDFの合計」を確認する。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import {
    fillLinkedFreeRow,
    getLinkedFreeRow,
    getQtys,
    isChecked,
    pickVariants,
    readScreenTotals,
    setChecked,
    setMember,
    setQty,
} from './helpers/itemTable'
import { readPdf, readSaved } from './helpers/documents'
import { saveAndExpectConsistent } from './helpers/assertions'

// ローカルの商品マスタにある、連動処理を持つ商品
const PARENT_ALTAR = '式場祭壇'
const SET_CHILDREN = ['棺', '納棺用品一式', '骨壺', '寝台車']
const MULTI_ROW_WITH_FIXED = '会葬礼状' // 「礼状版代（固定）」の固定料金行を持つ
const MULTI_ROW_CHILD = '霊柩車' // 親祭壇の子で、車種（固定）＋距離加算の2行
const WITH_LINKED_FREE_ROW = '控室管理費'
const VARIANT_GROUP = '重箱'

describe('見積画面: チェックの付け外し', () => {
    let session: Session
    let page: Page
    let pdfPage: Page
    let estimateId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        pdfPage = await session.newPage()
        const customerId = await createTestCase(session, '見積')
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('1. 新規作成直後の状態で登録しても、画面・保存値・PDFの合計が一致する', async () => {
        const { id } = await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '新規登録')
        estimateId = id
    })

    it('2. 親祭壇にチェックすると子のセット商品も数量1でチェックされ、外すと子も数量0に戻る', async () => {
        await setChecked(page, PARENT_ALTAR, true)
        for (const child of SET_CHILDREN) {
            expect(await isChecked(page, child), `${child} が連動してチェックされる`).toBe(true)
            expect((await getQtys(page, child))[0], `${child} の数量`).toBe(1)
        }
        expect((await getQtys(page, MULTI_ROW_CHILD))[0], `${MULTI_ROW_CHILD} の先頭行の数量`).toBe(1)

        await setChecked(page, PARENT_ALTAR, false)
        for (const child of [...SET_CHILDREN, MULTI_ROW_CHILD]) {
            const qtys = await getQtys(page, child).catch(() => [0]) // 親を外すと子の行が隠れることもある
            expect(qtys.every((q) => q === 0), `${child} の数量が全行0に戻る（${qtys}）`).toBe(true)
        }

        await setChecked(page, PARENT_ALTAR, true)
        await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '親祭壇あり')
    })

    it('3. 固定料金の行を持つ商品は、チェックを外すと全行が数量0になり合計からも消える', async () => {
        const before = await readScreenTotals(page)
        await setChecked(page, MULTI_ROW_WITH_FIXED, true)
        const qtysChecked = await getQtys(page, MULTI_ROW_WITH_FIXED)
        expect(qtysChecked[0], '固定料金の行の数量').toBeGreaterThan(0)
        expect((await readScreenTotals(page)).subtotal, 'チェックすると小計が増える').toBeGreaterThan(before.subtotal)

        await setChecked(page, MULTI_ROW_WITH_FIXED, false)
        const qtysUnchecked = await getQtys(page, MULTI_ROW_WITH_FIXED)
        expect(qtysUnchecked.every((q) => q === 0), `全行の数量が0（${qtysUnchecked}）`).toBe(true)
        expect((await readScreenTotals(page)).subtotal, '外すと小計がチェック前に戻る').toBe(before.subtotal)

        await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '固定料金の行を外した後')
    })

    it('4. 追加行を持つ商品は、チェックで追加行が出て、外すと追加行の数量が0になり保存にも残らない', async () => {
        await setChecked(page, WITH_LINKED_FREE_ROW, true)
        expect(await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW), '追加行が出る').not.toBeNull()
        await fillLinkedFreeRow(page, WITH_LINKED_FREE_ROW, { name: 'E2E追加', qty: 2, general: 5000, member: 4000 })
        const { id } = await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '追加行あり')
        const withRow = await readSaved(session, 'estimate', id)
        // 自由入力行は取得APIで書類の直下（freeItems）にまとめて返る
        const savedFreeNames = (withRow.raw.freeItems ?? []).map((f: any) => f.productItemName)
        expect(savedFreeNames, '追加行が保存される').toContain('E2E追加')

        await setChecked(page, WITH_LINKED_FREE_ROW, false)
        const linked = await getLinkedFreeRow(page, WITH_LINKED_FREE_ROW)
        expect(linked === null || linked.qty === 0, '外すと追加行の数量が0（または非表示）').toBe(true)
        const { id: id2 } = await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '追加行の親を外した後')
        const without = await readSaved(session, 'estimate', id2)
        const remaining = (without.raw.freeItems ?? []).filter((f: any) => f.productItemName === 'E2E追加' && Number(f.qty) > 0)
        expect(remaining, '数量1以上の追加行が残らない').toHaveLength(0)
    })

    it('5. 種類のグループで選ぶ商品を数量2にしても、画面・保存値・PDFの合計が一致する', async () => {
        await setChecked(page, VARIANT_GROUP, true)
        await pickVariants(page, VARIANT_GROUP, ['Cセット', '49日もち'])
        await setQty(page, VARIANT_GROUP, 2)
        await saveAndExpectConsistent(session, page, pdfPage, 'estimate', 'グループ商品を数量2')
    })

    it('6. 一般に切り替えて保存すると、合計が一致し、PDFに会員価格の列が出ない', async () => {
        await setMember(page, false)
        await saveAndExpectConsistent(session, page, pdfPage, 'estimate', '一般に切り替え')
        const pdf = await readPdf(pdfPage, 'estimate', estimateId)
        expect(pdf.headers, 'PDFの見出し').not.toContain('会員価格')
    })
})
