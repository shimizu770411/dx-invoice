// 一時: モンキーテスト（種1）15枚目の保存が終わらなかった手順の再生（調査後に削除する）
import { afterAll, beforeAll, describe, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { assertLocalEnvironment } from './helpers/env'
import { openSession, settle, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
import { pickVariants, setChecked, setMember, setPlan, setQty } from './helpers/itemTable'

const STOP_AT = Number(process.env.STOP_AT ?? 99)
describe('replay', () => {
    let session: Session
    let page: Page
    beforeAll(async () => { assertLocalEnvironment(); session = await openSession(); page = await session.newPage() })
    afterAll(async () => { await session?.close(); await cleanupTestCases() })
    it('15枚目', async () => {
        let invalid = ''
        page.on('console', (m) => { if (m.text().startsWith('DEBUG_INVALID')) invalid = m.text(); if (m.text().startsWith('DEBUG_PLAN')) console.log(m.text()) })
        await openBlankDocument(session, page, 'estimate', '再生15')
        const steps: [string, () => Promise<void>][] = [
            ['灯籠', () => setChecked(page, '灯籠・蓮華', true)],
            ['神式祭壇', () => setChecked(page, '神式祭壇', true)],
            ['納棺3', () => setQty(page, '納棺用品一式', 3)],
            ['写真', () => setChecked(page, '写真', true)],
            ['湯灌チェック', () => setChecked(page, '湯灌・メイク', true)],
            ['湯灌2', () => setQty(page, '湯灌・メイク', 2)],
            ['プラン', () => setPlan(page, '家族葬27万円コース')],
            ['27万2', () => setQty(page, '家族葬27万コース', 2)],
            ['脱臭200', () => setQty(page, '脱臭剤', 200)],
            ['27万0', () => setQty(page, '家族葬27万コース', 0)],
            ['料理', () => setChecked(page, '料理', true)],
            ['控室', () => setChecked(page, '控室管理費', true)],
            ['写真外す', () => setChecked(page, '写真', false)],
            ['湯灌種類', () => pickVariants(page, '湯灌・メイク', ['メイク一般'])],
            ['会員', () => setMember(page, true)],
            ['モニター', () => setChecked(page, '式場モニター', true)],
        ]
        const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
        for (const [label, step] of steps.slice(0, STOP_AT)) { if (only.length && !only.includes(label)) continue; await step() }
        await page.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find((x) => /^(登\s*録)$/.test(x.textContent?.trim() ?? ''))
            ;(b as HTMLButtonElement | undefined)?.click()
        })
        await settle(page, 9000)
        const items = invalid ? invalid.match(/"items":\[(.*)\]/)?.[1] ?? '' : ''
        console.log(`STOP_AT=${STOP_AT} last=${steps[Math.min(STOP_AT, steps.length) - 1][0]} saved=${!page.url().includes('/new')} invalid=${items.replace(/null,/g, '').slice(0, 200)}`)
    })
})
