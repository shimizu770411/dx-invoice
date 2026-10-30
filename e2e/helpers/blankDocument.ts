// テストの出発点になる見積・請求書の編集画面を開く。
// 見積・請求書は同じ明細表を使うため、同じ操作を両方の画面で確かめるテストの出発点にする。
//
// 「ふつうの商品」を1品だけ入れた状態で開く（下支え）。品目が1つも無い書類は保存できない仕様のため、
// 以前のように「何もチェックしない状態」から始めると、テストで入れた商品を外した時点で保存できなくなる。
// 以前はプランの初期セット品（基本プランの脱臭剤）が自動で入っていたので通っていたが、
// 本番で初期セット品が外れた（2026-10-20）ことで前提が崩れた。マスタに頼らずテスト自身が入れる。
import type { Page } from 'puppeteer-core'
import { gotoAndSettle, type Session } from './session'
import { createTestCase } from './testData'
import { save, setChecked } from './itemTable'
import { findPlainProduct, loadMaster } from './masterLookup'
import type { DocKind } from './documents'

export type BlankDocument = {
    /** 下支えとして入れた商品。テスト側でこの商品を操作しないこと */
    anchor: string
}

export async function openBlankDocument(session: Session, page: Page, kind: DocKind, label: string): Promise<BlankDocument> {
    const anchor = findPlainProduct(await loadMaster(session))
    if (!anchor) throw new Error('E2E: 今の商品マスタに、下支えに使えるふつうの商品（特別な設定の無い一般商品）がありません')

    const customerId = await createTestCase(session, label)
    await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
    await setChecked(page, anchor, true)
    if (kind === 'estimate') return { anchor }

    // 請求書は本見積から作るため、下支えの商品だけ入れた見積を保存してから作る
    const preId = await save(page)
    const formal = await session.api('POST', `/estimates/${preId}/confirm`)
    if (formal.status !== 200) throw new Error(`E2E: 本見積を作成できません (${formal.status})`)
    const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formal.json.id}`)
    if (invoice.status !== 200) throw new Error(`E2E: 請求書を作成できません (${invoice.status})`)
    await gotoAndSettle(page, `/invoices/${invoice.json.id}`)
    return { anchor }
}
