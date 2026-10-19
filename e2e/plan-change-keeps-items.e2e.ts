// 見積画面でプランを切り替えても、選んだ重箱（種類のグループで選ぶ商品）の種類・数量が消えないことの通しテスト。
// 以前は、重箱を選んでからプランを切り替えると、重箱が未チェック・種類なしに作り直されていた。
// 重箱はどのプランにも出る商品のため「消える明細」の確認も出ず、気付かずに保存すると重箱の無い見積になっていた。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { getQtys, isChecked, pickVariants, save, setChecked, setPlan, setQty } from './helpers/itemTable'

const VARIANT_GROUP = '重箱'

describe('見積画面: プラン切替と重箱', () => {
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

    it('重箱の種類と数量を選んでからプランを切り替えても、選んだまま残り、保存後も同じ', async () => {
        // 今のプランとは別の、有効なプランへ切り替える
        const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, select: { name: true } })
        if (plans.length < 2) throw new Error('E2E: 切り替え先のプランがありません（有効なプランが2つ以上必要）')

        await openBlankDocument(session, page, 'estimate', 'プラン切替重箱')
        await setChecked(page, VARIANT_GROUP, true)
        await pickVariants(page, VARIANT_GROUP, ['Cセット'])
        await setQty(page, VARIANT_GROUP, 3)

        await setPlan(page, plans[1].name)
        expect(await isChecked(page, VARIANT_GROUP), 'プラン切替後もチェックが付いている').toBe(true)
        expect((await getQtys(page, VARIANT_GROUP))[0], 'プラン切替後の数量').toBe(3)

        const id = await save(page)
        const saved = await prisma.estimateItem.findMany({
            where: { estimateId: BigInt(id), productItem: { name: VARIANT_GROUP } },
            select: { qty: true, productVariantName: true },
        })
        expect(saved.length, '重箱が保存されている').toBeGreaterThan(0)
        expect(saved.every((s) => s.qty === 3), '保存された重箱の数量').toBe(true)

        await gotoAndSettle(page, `/estimates/${id}`)
        expect(await isChecked(page, VARIANT_GROUP), '開き直してもチェックが付いている').toBe(true)
        expect((await getQtys(page, VARIANT_GROUP))[0], '開き直した後の数量').toBe(3)
    })
})
