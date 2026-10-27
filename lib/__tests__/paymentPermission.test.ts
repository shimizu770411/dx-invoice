import { describe, it, expect } from 'vitest'
import { canManagePayment } from '../paymentPermission'

describe('canManagePayment', () => {
    it('事務員・経理・決裁者は入金を扱える', () => {
        expect(canManagePayment('CLERK')).toBe(true)
        expect(canManagePayment('ACCOUNTING')).toBe(true)
        expect(canManagePayment('APPROVER')).toBe(true)
    })

    it('担当者は入金を扱えない', () => {
        expect(canManagePayment('STAFF')).toBe(false)
    })

    it('ロールが分からない（ログイン情報の取得前など）ときは扱えない側に倒す', () => {
        expect(canManagePayment(undefined)).toBe(false)
        expect(canManagePayment(null)).toBe(false)
        expect(canManagePayment('')).toBe(false)
    })
})
