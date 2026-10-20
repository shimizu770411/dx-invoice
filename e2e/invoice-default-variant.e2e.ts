// 請求書画面で後からチェックした商品の初期の種類が、見積画面と同じになることの通しテスト。
// 以前は請求書だけ「種類の先頭」を初期にしており、プラン別設定で先頭以外の種類を初期セット品にしている商品
// （家族葬37万円コースのホール管理費＝「家族葬」など）を請求書で後から入れると、見積と違う種類・金額になっていた。
// 請求書の明細の組み立てを見積と共通の処理にして解消した。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import { getTypeText, save, setChecked, setPlan } from './helpers/itemTable'

const SEED_PRODUCT = '控室管理費'

describe('請求書画面: 後からチェックした商品の初期の種類', () => {
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

    it('プラン別設定で先頭以外の種類を初期セット品にした商品は、請求書で後からチェックしてもその種類になる', async () => {
        // プラン別設定で「先頭ではない種類」を初期セット品にしている商品を、ローカルの設定から探す
        const settings = await prisma.productPlanSetting.findMany({
            where: { overrideDefaultVariantId: { not: null }, isVisible: true, plan: { isActive: true } },
            select: {
                plan: { select: { name: true } },
                productItem: {
                    select: {
                        name: true,
                        isActive: true,
                        isSetChild: true,
                        variants: { where: { isActive: true, storeId: null }, orderBy: [{ sortNo: 'asc' }, { id: 'asc' }], select: { id: true, name: true } },
                    },
                },
                overrideDefaultVariant: { select: { id: true, name: true } },
            },
        })
        const target = settings.find(
            (s) =>
                s.productItem.isActive &&
                !s.productItem.isSetChild &&
                s.productItem.name !== SEED_PRODUCT &&
                s.overrideDefaultVariant &&
                s.productItem.variants.length > 1 &&
                s.productItem.variants[0].id !== s.overrideDefaultVariant.id
        )
        if (!target) throw new Error('E2E: 先頭以外の種類を初期セット品にしたプラン別設定が見つかりません')
        const product = target.productItem.name
        const expectedVariant = target.overrideDefaultVariant!.name

        // そのプランで、対象商品を入れずに見積を保存し、本見積 → 請求書を作る
        const customerId = await createTestCase(session, '請求書初期種類')
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
        await setPlan(page, target.plan.name)
        await setChecked(page, product, false)
        await setChecked(page, SEED_PRODUCT, true)
        const preId = await save(page)
        const formal = await session.api('POST', `/estimates/${preId}/confirm`)
        if (formal.status !== 200) throw new Error(`E2E: 本見積を作成できません (${formal.status})`)
        const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formal.json.id}`)
        if (invoice.status !== 200) throw new Error(`E2E: 請求書を作成できません (${invoice.status})`)
        await gotoAndSettle(page, `/invoices/${invoice.json.id}`)

        await setChecked(page, product, true)
        expect(await getTypeText(page, product), `${product} の種類（${target.plan.name}）`).toContain(expectedVariant)
    })
})
