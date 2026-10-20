// 明細が何もチェックされていない見積・請求書の編集画面を開く。
// 見積・請求書は同じ明細表を使うため、同じ操作を両方の画面で確かめるテストの出発点にする。
import type { Page } from 'puppeteer-core'
import { gotoAndSettle, type Session } from './session'
import { createTestCase } from './testData'
import { save, setChecked } from './itemTable'
import type { DocKind } from './documents'

// 請求書は本見積から作るため、いったん1品だけ入れた見積を保存し、請求書画面でそのチェックを外す
const SEED_PRODUCT = '控室管理費'

export async function openBlankDocument(session: Session, page: Page, kind: DocKind, label: string): Promise<void> {
    const customerId = await createTestCase(session, label)
    await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
    if (kind === 'estimate') return

    await setChecked(page, SEED_PRODUCT, true)
    const preId = await save(page)
    const formal = await session.api('POST', `/estimates/${preId}/confirm`)
    if (formal.status !== 200) throw new Error(`E2E: 本見積を作成できません (${formal.status})`)
    const invoice = await session.api('POST', `/invoices/customers/${customerId}/from-estimate/${formal.json.id}`)
    if (invoice.status !== 200) throw new Error(`E2E: 請求書を作成できません (${invoice.status})`)
    await gotoAndSettle(page, `/invoices/${invoice.json.id}`)
    await setChecked(page, SEED_PRODUCT, false)
}
