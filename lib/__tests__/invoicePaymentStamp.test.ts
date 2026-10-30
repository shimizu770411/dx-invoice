import { describe, it, expect } from 'vitest'
import { buildInvoicePaymentStamp } from '../invoicePaymentStamp'

describe('buildInvoicePaymentStamp', () => {
    it('押印欄は 事務・責任者・担当者 の順で、事務員・決裁者・担当者の確認者をそれぞれ入れる', () => {
        const stamp = buildInvoicePaymentStamp({
            staffConfirmedBy: { name: '照喜名', sealImageUrl: 'https://example.com/staff.png' },
            clerkConfirmedBy: { name: '事務太郎', sealImageUrl: null },
            approverConfirmedBy: { name: '決裁花子', sealImageUrl: 'https://example.com/approver.png' },
        })
        expect(stamp.cells).toEqual([
            { label: '事務', person: { name: '事務太郎', sealImageUrl: null } },
            { label: '責任者', person: { name: '決裁花子', sealImageUrl: 'https://example.com/approver.png' } },
            { label: '担当者', person: { name: '照喜名', sealImageUrl: 'https://example.com/staff.png' } },
        ])
    })

    it('確認していない欄は空', () => {
        const stamp = buildInvoicePaymentStamp({ staffConfirmedBy: null })
        expect(stamp.cells.map((c) => c.person)).toEqual([null, null, null])
    })

    it('入金済みなら入金日を出す', () => {
        const stamp = buildInvoicePaymentStamp({ isPaid: true, paidAt: '2026-10-01T00:00:00.000Z' })
        expect(stamp).toMatchObject({ isPaid: true, paidAt: '2026-10-01T00:00:00.000Z' })
    })

    it('入金前（または取消後）は入金日を出さない', () => {
        expect(buildInvoicePaymentStamp({ isPaid: false, paidAt: '2026-10-01T00:00:00.000Z' })).toMatchObject({
            isPaid: false,
            paidAt: null,
        })
    })
})
