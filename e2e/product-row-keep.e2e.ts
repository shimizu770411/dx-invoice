// 商品マスタで複数行構成の商品を保存しても、既存の見積の明細とのつながりが切れないことの通しテスト。
// 以前は保存のたびに商品の行・種類を全部作り直しており、既存の見積・請求書の明細から行・種類への
// つながりが空になっていた（画面では未選択に見え、更新すると明細が消える。PDFでは返品がプラスで計上される）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases, createTestCase } from './helpers/testData'
import { getQtys, isChecked, readScreenTotals, save, setChecked, setQty } from './helpers/itemTable'
import { findMultiRowWithReturn, findParentAltar, loadMaster, need } from './helpers/masterLookup'

// 複数行構成の商品（霊柩車の役: 親祭壇の子で固定料金の行＋距離の行、御供養の役: 返品行あり）。
// その時の商品マスタから役割で探す（helpers/masterLookup.ts）
let MULTI_ROW_PRODUCTS: string[] = []
let RETURN_PRODUCT: string | null = null

async function savedRowLinks(estimateId: string) {
    const items = await prisma.estimateItem.findMany({
        where: { estimateId: BigInt(estimateId), productItem: { name: { in: MULTI_ROW_PRODUCTS } } },
        select: { id: true, productItemId: true, productRowId: true, productRowVariantId: true, sign: true, qty: true },
        orderBy: { id: 'asc' },
    })
    return items.map((i) => ({
        id: String(i.id),
        productItemId: String(i.productItemId),
        productRowId: i.productRowId === null ? null : String(i.productRowId),
        productRowVariantId: i.productRowVariantId === null ? null : String(i.productRowVariantId),
        sign: i.sign,
        qty: i.qty,
    }))
}

// 商品マスタの編集画面を開き、何も変えずに「商品を保存」を押す
async function saveProductWithoutChanges(page: Page, productId: string): Promise<void> {
    await gotoAndSettle(page, `/products/${productId}`)
    const responsePromise = page.waitForResponse(
        (res) => res.url().endsWith(`/api/products/${productId}`) && res.request().method() === 'PUT'
    )
    const clicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '商品を保存')
        if (!button || (button as HTMLButtonElement).disabled) return false
        ;(button as HTMLButtonElement).click()
        return true
    })
    if (!clicked) throw new Error(`E2E: 商品 ${productId} の「商品を保存」を押せません`)
    const res = await responsePromise
    if (res.status() !== 200) throw new Error(`E2E: 商品 ${productId} を保存できません (${res.status()})`)
    await settle(page, 1500)
}

describe('商品マスタの保存: 既存の見積とのつながり', () => {
    let session: Session
    let page: Page
    let estimateId = ''

    beforeAll(async () => {
        assertLocalEnvironment()
        session = await openSession()
        page = await session.newPage()
        const master = await loadMaster(session)
        const parent = findParentAltar(master)
        RETURN_PRODUCT = findMultiRowWithReturn(master)?.name ?? null
        MULTI_ROW_PRODUCTS = [parent?.multiRowChild ?? null, RETURN_PRODUCT].filter((n): n is string => !!n)
        if (MULTI_ROW_PRODUCTS.length === 0) return

        const customerId = await createTestCase(session, '商品マスタ保存')
        await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
        // 霊柩車の役の商品は祭壇のセット商品で、親の祭壇を選ぶまで行が出ない
        if (parent?.multiRowChild) await setChecked(page, parent.name, true)
        for (const name of MULTI_ROW_PRODUCTS) await setChecked(page, name, true)
        if (RETURN_PRODUCT) await setQty(page, RETURN_PRODUCT, 30)
        estimateId = await save(page)
    })

    afterAll(async () => {
        await session?.close()
        await cleanupTestCases()
    })

    it('複数行構成の商品を変更せずに保存しても、見積の明細の行・種類のつながりと合計が変わらない', async (ctx) => {
        need(ctx, MULTI_ROW_PRODUCTS.length > 0 ? MULTI_ROW_PRODUCTS : null, '複数行構成の商品（親祭壇の子で複数行のもの、または返品行のあるもの）')
        const before = await savedRowLinks(estimateId)
        expect(before.length, `${MULTI_ROW_PRODUCTS.join('・')}の明細が保存されている`).toBeGreaterThan(0)
        expect(before.every((i) => i.productRowId !== null && i.productRowVariantId !== null), '保存直後はつながっている').toBe(true)
        await gotoAndSettle(page, `/estimates/${estimateId}`)
        const totalsBefore = await readScreenTotals(page)

        const products = await prisma.productItem.findMany({ where: { name: { in: MULTI_ROW_PRODUCTS } }, select: { id: true } })
        for (const p of products) await saveProductWithoutChanges(page, String(p.id))

        const after = await savedRowLinks(estimateId)
        expect(after, '商品マスタ保存後も、明細の行・種類のつながりがそのまま').toEqual(before)

        await gotoAndSettle(page, `/estimates/${estimateId}`)
        for (const name of MULTI_ROW_PRODUCTS) {
            expect(await isChecked(page, name), `${name} がチェックされたまま`).toBe(true)
        }
        if (RETURN_PRODUCT) expect((await getQtys(page, RETURN_PRODUCT))[0], `${RETURN_PRODUCT}の数量`).toBe(30)
        expect(await readScreenTotals(page), '見積画面の合計が変わらない').toEqual(totalsBefore)
    })
})
