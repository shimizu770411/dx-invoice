import type { AppliesTo } from '@/lib/products'

/**
 * AppliesTo スコープが現在の顧客モード（会員/一般）に適用されるか判定する。
 * 不正値や null/undefined は NONE 扱い（適用しない）。
 */
export function scopeApplies(scope: AppliesTo | null | undefined, isMember: boolean): boolean {
    if (scope === 'BOTH') return true
    if (scope === 'MEMBER_ONLY') return isMember
    if (scope === 'GENERAL_ONLY') return !isMember
    return false
}

export const APPLIES_TO_OPTIONS: { value: AppliesTo; label: string; desc: string }[] = [
    { value: 'NONE', label: '不可', desc: '一般・会員ともに対象外' },
    { value: 'MEMBER_ONLY', label: '会員のみ', desc: '互助会員のときだけ適用' },
    { value: 'GENERAL_ONLY', label: '一般のみ', desc: '一般顧客のときだけ適用' },
    { value: 'BOTH', label: '両方', desc: '一般・会員ともに適用' },
]
