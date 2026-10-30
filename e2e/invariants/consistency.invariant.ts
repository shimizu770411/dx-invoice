// 本番データ全体で「必ず成り立つべきこと」を確かめる整合確認（通常の通しテストとは別に流す）。
//   npm run test:e2e:invariants
// 特定の商品・初期状態を前提にせず、その時のローカルDB（本番のコピー）にある書類・マスタ全部を対象にする。
// 客先がマスタを変えても前提が崩れない。落ちたら、どの書類・どの商品で何が食い違ったかをそのまま出す。
//
// 件数が多いと時間がかかる（見積・請求書あわせて約180件で20〜30分）。
// E2E_INVARIANT_LIMIT=10 のように指定すると、見積・請求書をそれぞれ新しい順にその件数だけ確かめる。
// E2E_INVARIANT_DOCS=estimate:76,invoice:36 のように指定すると、その書類だけ確かめる（気になる書類の確認用）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { BASE_PLAN_ID } from '@/lib/plans'
import { assertLocalEnvironment, E2E_NAME_PREFIX } from '../helpers/env'
import { gotoAndSettle, openSession, type Session } from '../helpers/session'
import { cleanupTestCases, createTestCase } from '../helpers/testData'
import { readScreenTotals, setChecked, setPlan } from '../helpers/itemTable'
import { pdfColumnFor, readPdf, readSaved, type DocKind } from '../helpers/documents'
import { saveAndExpectConsistent } from '../helpers/assertions'
import { findPlainProduct, loadAllMasters } from '../helpers/masterLookup'
import { KNOWN_MISMATCHES } from './knownMismatches'

const LIMIT = process.env.E2E_INVARIANT_LIMIT ? Number(process.env.E2E_INVARIANT_LIMIT) : undefined
const ONLY_DOCS = process.env.E2E_INVARIANT_DOCS ? process.env.E2E_INVARIANT_DOCS.split(',').map((d) => d.trim()) : null
const onlyIds = (kind: DocKind) =>
    ONLY_DOCS ? ONLY_DOCS.filter((d) => d.startsWith(`${kind}:`)).map((d) => BigInt(d.slice(kind.length + 1))) : null
const TOTAL_KEYS = ['subtotal', 'tax', 'total', 'grandTotal'] as const
const yen = (n: number) => n.toLocaleString('ja-JP')

describe('本番データ全体の整合', () => {
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

    it('見積・請求書の、複数行構成商品の明細は、商品マスタの行とのつながりが切れていない', async () => {
        // 2026-10-19、商品マスタの保存で行が作り直され、つながりが空になる不具合があった（明細が未選択に見え、PDFで返品がプラス計上）
        const broken = [
            ...(await prisma.estimateItem.findMany({
                where: { productRowId: null, productItem: { isMultiRow: true } },
                select: { productItem: { select: { name: true } }, estimate: { select: { docNo: true, id: true } } },
            })).map((x) => `見積 ${x.estimate.docNo ?? `(番号なし id=${x.estimate.id})`}: ${x.productItem?.name}`),
            ...(await prisma.invoiceItem.findMany({
                where: { productRowId: null, productItem: { isMultiRow: true } },
                select: { productItem: { select: { name: true } }, invoice: { select: { docNo: true, id: true } } },
            })).map((x) => `請求書 ${x.invoice.docNo ?? `(番号なし id=${x.invoice.id})`}: ${x.productItem?.name}`),
        ]
        expect(broken, '商品マスタの行とのつながりが切れている明細').toEqual([])
    })

    it('有効なすべてのプランで、新しい見積にふつうの商品を入れて保存でき、画面・保存値・PDFの合計が一致する', async () => {
        const problems: string[] = []
        for (const master of await loadAllMasters(session)) {
            const plain = findPlainProduct(master)
            if (!plain) {
                problems.push(`${master.planName}: ふつうの商品（特別な設定の無い一般商品）が1つも出ない`)
                continue
            }
            try {
                const customerId = await createTestCase(session, `整合_${master.planName}`)
                await gotoAndSettle(page, `/estimates/new?customerId=${customerId}`)
                if (master.planId !== BASE_PLAN_ID) await setPlan(page, master.planName)
                await setChecked(page, plain, true)
                await saveAndExpectConsistent(session, page, pdfPage, 'estimate', `${master.planName}で新規見積`)
            } catch (error) {
                problems.push(`${master.planName}（${plain}）: ${(error as Error).message.split('\n')[0]}`)
            }
        }
        expect(problems, '新規見積を保存できない、または合計が食い違うプラン').toEqual([])
    })

    it('すべての見積・請求書で、保存値・画面・PDFの合計が一致する', async () => {
        const notTest = { customer: { deceasedName: { not: { startsWith: E2E_NAME_PREFIX } } } }
        const estimateIds = onlyIds('estimate')
        const invoiceIds = onlyIds('invoice')
        const estimates = await prisma.estimate.findMany({ where: { ...notTest, ...(estimateIds ? { id: { in: estimateIds } } : {}) }, select: { id: true, docNo: true }, orderBy: { id: 'desc' }, take: LIMIT })
        const invoices = await prisma.invoice.findMany({ where: { ...notTest, ...(invoiceIds ? { id: { in: invoiceIds } } : {}) }, select: { id: true, docNo: true }, orderBy: { id: 'desc' }, take: LIMIT })
        const targets: { kind: DocKind; id: string; label: string }[] = [
            ...estimates.map((e) => ({ kind: 'estimate' as const, id: e.id.toString(), label: `見積 ${e.docNo ?? `(番号なし id=${e.id})`}` })),
            ...invoices.map((i) => ({ kind: 'invoice' as const, id: i.id.toString(), label: `請求書 ${i.docNo ?? `(番号なし id=${i.id})`}` })),
        ]

        // 原因が分かっていて今は直さない食い違い（knownMismatches.ts）は落とさず一覧に出すだけ。それ以外は新しい問題として落とす
        const mismatches: string[] = []
        const known: string[] = []
        const stillMismatchedKnownKeys = new Set<string>()
        for (const [i, t] of targets.entries()) {
            const key = `${t.kind}:${t.id}`
            let problem: string | null = null
            try {
                const saved = await readSaved(session, t.kind, t.id)
                await gotoAndSettle(page, `/${t.kind === 'estimate' ? 'estimates' : 'invoices'}/${t.id}`)
                const screen = await readScreenTotals(page)
                const pdf = pdfColumnFor(await readPdf(pdfPage, t.kind, t.id), saved.isMember)
                const diffs = TOTAL_KEYS.filter((k) => saved[k] !== screen[k] || screen[k] !== pdf[k]).map(
                    (k) => `${k} 保存=${yen(saved[k])} 画面=${yen(screen[k])} PDF=${yen(pdf[k])}`
                )
                if (diffs.length > 0) problem = `${t.label}: ${diffs.join(' / ')}`
            } catch (error) {
                problem = `${t.label}: 確認できませんでした（${(error as Error).message.split('\n')[0]}）`
            }
            const knownEntry = KNOWN_MISMATCHES.get(key)
            if (problem && knownEntry) {
                known.push(`${problem}（既知: ${knownEntry.reason}）`)
                stillMismatchedKnownKeys.add(key)
            } else if (problem) {
                mismatches.push(problem)
            }
            // 時間がかかるため、途中経過を20件ごとに出す
            if ((i + 1) % 20 === 0 || i + 1 === targets.length) {
                console.log(`  ${i + 1}/${targets.length}件 確認済み（新しい食い違い ${mismatches.length}件・既知 ${known.length}件）`)
            }
        }
        // 既知として載せていたのに、今回は食い違わなかった書類（保存し直されたなど）。knownMismatches.ts から消してよい
        const checkedKeys = new Set(targets.map((t) => `${t.kind}:${t.id}`))
        const resolved = [...KNOWN_MISMATCHES.keys()].filter((k) => checkedKeys.has(k) && !stillMismatchedKnownKeys.has(k))

        console.log(
            [
                `見積${estimates.length}件・請求書${invoices.length}件を確認。新しい食い違い ${mismatches.length}件・既知の食い違い ${known.length}件`,
                ...(known.length > 0 ? ['■ 既知の食い違い（落とさない）', ...known.map((k) => `  ${k}`)] : []),
                ...(resolved.length > 0 ? ['■ 解消した既知の食い違い（knownMismatches.ts から消してよい）', ...resolved.map((k) => `  ${k}`)] : []),
            ].join('\n')
        )
        expect(mismatches, '保存値・画面・PDFの合計が食い違う書類（既知の分を除く）').toEqual([])
    })
})
