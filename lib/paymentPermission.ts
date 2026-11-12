/**
 * 入金の登録・取消ができるロール。画面のボタンとAPIの両方がこの判定を使う。
 * 担当者（STAFF）は扱えない。管理者の印（isAdmin）は判定に使わない。
 * lib/users.ts は画面用のAPI呼び出しを含むため、APIからも読み込めるようここに分けて置く。
 */
export const PAYMENT_ROLES = ['CLERK', 'ACCOUNTING', 'APPROVER'] as const

export const PAYMENT_ROLE_DENIED_MESSAGE = '入金の登録・取消は事務員・経理・決裁者のみ行えます'

export function canManagePayment(role: string | null | undefined): boolean {
    return (PAYMENT_ROLES as readonly string[]).includes(role ?? '')
}

/**
 * 領収書の承認・承認取消ができるロール。承認した人の印影が領収書の取扱者印に出る。
 * 入金を扱える経理（ACCOUNTING）は承認できない（2026-11-12 ユーザー指示）。
 */
export const RECEIPT_APPROVAL_ROLES = ['CLERK', 'APPROVER'] as const

export const RECEIPT_APPROVAL_ROLE_DENIED_MESSAGE = '領収書の承認・承認取消は事務員・決裁者のみ行えます'

export function canApproveReceipt(role: string | null | undefined): boolean {
    return (RECEIPT_APPROVAL_ROLES as readonly string[]).includes(role ?? '')
}
