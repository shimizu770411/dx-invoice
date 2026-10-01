import { describe, it, expect } from 'vitest'
import { buildCaseSteps, toCaseProgress, CaseStepKey } from '@/lib/caseProgress'

/**
 * 案件の進捗（どこまで書類ができているか）の判定。
 *
 * この判定は案件一覧の行と、各画面上部の切替バーの両方で使う。
 * 片方だけ条件が変わると、同じ案件なのに一覧からは請求書が作れて
 * 見積画面からは作れない、といった食い違いが起きる。
 * 判定表をここで固定しておく。
 */

const noDocuments = { hasEstimate: false, hasInvoice: false, isPaid: false }

/** ステップを key で引く。並び順の検証とは分けて書くためのヘルパー */
function step(progress: Parameters<typeof buildCaseSteps>[0], key: CaseStepKey) {
    return buildCaseSteps(progress).find((s) => s.key === key)
}

describe('操作ボタンの並び', () => {
    it('情報編集 → 見積 → 請求 → 入金 → 領収書 → 供花 の順に並ぶ', () => {
        expect(buildCaseSteps(noDocuments).map((s) => s.key)).toEqual([
            'case',
            'estimate',
            'invoice',
            'payment',
            'receipt',
            'flowers',
        ])
    })

    it('情報編集と供花は書類の流れとは別のまとまりにする', () => {
        const steps = buildCaseSteps(noDocuments)
        expect(steps.find((s) => s.key === 'case')?.group).toBe('edit')
        expect(steps.find((s) => s.key === 'flowers')?.group).toBe('parallel')
        expect(steps.filter((s) => s.group === 'flow').map((s) => s.key)).toEqual([
            'estimate',
            'invoice',
            'payment',
            'receipt',
        ])
    })

    it('本見積があるときだけ、事前相談見積のボタンを見積の手前に出す', () => {
        const withFormal = {
            hasEstimate: true,
            estimateType: 'FORMAL' as const,
            preConsultEstimateId: '7',
            hasInvoice: false,
            isPaid: false,
        }
        expect(buildCaseSteps(withFormal).map((s) => s.key)).toEqual([
            'case',
            'preConsultEstimate',
            'estimate',
            'invoice',
            'payment',
            'receipt',
            'flowers',
        ])
    })

    it('事前相談見積から本見積を作っていない間は、見積ボタン1つだけにする', () => {
        const preConsultOnly = {
            hasEstimate: true,
            estimateType: 'PRE_CONSULTATION' as const,
            preConsultEstimateId: '7',
            hasInvoice: false,
            isPaid: false,
        }
        expect(step(preConsultOnly, 'preConsultEstimate')).toBeUndefined()
    })

    it('本見積があっても事前相談見積が無い案件では別枠ボタンを出さない', () => {
        const formalOnly = {
            hasEstimate: true,
            estimateType: 'FORMAL' as const,
            preConsultEstimateId: null,
            hasInvoice: false,
            isPaid: false,
        }
        expect(step(formalOnly, 'preConsultEstimate')).toBeUndefined()
    })
})

describe('見積ボタンの表示', () => {
    it('見積が無ければ「見積書作成」', () => {
        expect(step(noDocuments, 'estimate')).toMatchObject({ label: '見積書作成', variant: 'primary' })
    })

    it('事前相談見積だけなら「事前相談見積」', () => {
        const s = step({ ...noDocuments, hasEstimate: true, estimateType: 'PRE_CONSULTATION' }, 'estimate')
        expect(s).toMatchObject({ label: '事前相談見積', variant: 'done' })
    })

    it('本見積があれば「本見積編集」', () => {
        const s = step({ ...noDocuments, hasEstimate: true, estimateType: 'FORMAL' }, 'estimate')
        expect(s).toMatchObject({ label: '本見積編集', variant: 'gold' })
    })
})

describe('次に進めるかどうか', () => {
    it('本見積を作るまで請求書は押せない', () => {
        expect(step(noDocuments, 'invoice')).toMatchObject({
            disabled: true,
            lockedReason: '本見積作成後に使用できます',
        })
        const preConsultOnly = { ...noDocuments, hasEstimate: true, estimateType: 'PRE_CONSULTATION' as const }
        expect(step(preConsultOnly, 'invoice')?.disabled).toBe(true)
    })

    it('本見積があれば請求書を作れる', () => {
        const formal = { ...noDocuments, hasEstimate: true, estimateType: 'FORMAL' as const }
        expect(step(formal, 'invoice')).toMatchObject({
            disabled: false,
            label: '請求書作成',
            variant: 'primary',
            lockedReason: undefined,
        })
    })

    it('請求書があれば「請求書編集」になり、入金に進める', () => {
        const invoiced = { hasEstimate: true, estimateType: 'FORMAL' as const, hasInvoice: true, isPaid: false }
        expect(step(invoiced, 'invoice')).toMatchObject({ label: '請求書編集', variant: 'done' })
        expect(step(invoiced, 'payment')).toMatchObject({ disabled: false, label: '入金登録', variant: 'alert' })
    })

    it('請求書を作るまで入金は押せない', () => {
        expect(step(noDocuments, 'payment')).toMatchObject({
            disabled: true,
            lockedReason: '請求書作成後に使用できます',
        })
    })

    it('入金するまで領収書は押せない', () => {
        const invoiced = { hasEstimate: true, estimateType: 'FORMAL' as const, hasInvoice: true, isPaid: false }
        expect(step(invoiced, 'receipt')).toMatchObject({
            disabled: true,
            lockedReason: '入金登録後に使用できます',
        })
    })

    it('入金済みなら領収書を出せて、入金ボタンは取消に変わる', () => {
        const paid = { hasEstimate: true, estimateType: 'FORMAL' as const, hasInvoice: true, isPaid: true }
        expect(step(paid, 'receipt')).toMatchObject({ disabled: false, variant: 'gold' })
        expect(step(paid, 'payment')).toMatchObject({ disabled: false, label: '入金取消', variant: 'done' })
    })

    it('情報編集と供花はいつでも押せる', () => {
        expect(step(noDocuments, 'case')?.disabled).toBe(false)
        expect(step(noDocuments, 'flowers')?.disabled).toBe(false)
    })
})

describe('DBの取得結果から進捗を組み立てる', () => {
    const base = { id: 12n, receptionNo: '2026-0001', deceasedName: '島袋太郎' }

    it('書類が1件も無い案件', () => {
        expect(toCaseProgress({ ...base, estimates: [], invoices: [] })).toEqual({
            customerId: '12',
            receptionNo: '2026-0001',
            deceasedName: '島袋太郎',
            hasEstimate: false,
            estimateId: null,
            estimateStatus: null,
            estimateType: null,
            preConsultEstimateId: null,
            hasInvoice: false,
            invoiceId: null,
            isPaid: false,
        })
    })

    it('事前相談見積と本見積の両方があれば、本見積を代表として返す', () => {
        const progress = toCaseProgress({
            ...base,
            estimates: [
                { id: 5n, status: 'CONFIRMED', estimateType: 'PRE_CONSULTATION' },
                { id: 9n, status: 'DRAFT', estimateType: 'FORMAL' },
            ],
            invoices: [],
        })
        expect(progress.estimateId).toBe('9')
        expect(progress.estimateType).toBe('FORMAL')
        expect(progress.estimateStatus).toBe('DRAFT')
        expect(progress.preConsultEstimateId).toBe('5')
    })

    it('事前相談見積だけなら、それを代表として返す', () => {
        const progress = toCaseProgress({
            ...base,
            estimates: [{ id: 5n, status: 'DRAFT', estimateType: 'PRE_CONSULTATION' }],
            invoices: [],
        })
        expect(progress.estimateId).toBe('5')
        expect(progress.estimateType).toBe('PRE_CONSULTATION')
        expect(progress.preConsultEstimateId).toBe('5')
    })

    it('請求書に入金済みの記録があれば入金済みとする', () => {
        const progress = toCaseProgress({
            ...base,
            estimates: [],
            invoices: [{ id: 30n, payments: [{ status: 'PAID' }] }],
        })
        expect(progress.hasInvoice).toBe(true)
        expect(progress.invoiceId).toBe('30')
        expect(progress.isPaid).toBe(true)
    })

    it('入金が取消されていれば未入金に戻る', () => {
        // 取消の記録が最新になるため、最新1件だけを見れば未入金と分かる
        const progress = toCaseProgress({
            ...base,
            estimates: [],
            invoices: [{ id: 30n, payments: [{ status: 'CANCELLED' }] }],
        })
        expect(progress.isPaid).toBe(false)
    })

    it('請求書はあるが入金の記録が無ければ未入金', () => {
        const progress = toCaseProgress({ ...base, estimates: [], invoices: [{ id: 30n, payments: [] }] })
        expect(progress.hasInvoice).toBe(true)
        expect(progress.isPaid).toBe(false)
    })
})
