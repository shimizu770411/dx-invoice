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
