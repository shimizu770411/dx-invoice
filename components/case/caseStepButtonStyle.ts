import type { CaseStepVariant } from '@/lib/caseProgress'

/**
 * 案件の操作ボタン（見積・請求・入金・領収書など）の配色。
 *
 * 案件一覧の行と、各画面上部の切替バーで同じ見た目にするために共有している。
 * 色が片方だけ変わると、同じボタンが画面によって別物に見える。
 */
export function caseStepButtonStyle(variant: CaseStepVariant, disabled = false): React.CSSProperties {
    const base: React.CSSProperties = {
        letterSpacing: '0.12em',
        fontWeight: 500,
        // variantごとにborderColor/borderStyleだけを上書きするため、
        // shorthand(border)とlonghandの混在を避けて個別プロパティで指定する
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'transparent',
        transition: 'all 0.15s ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
    }

    if (disabled) {
        return {
            ...base,
            backgroundColor: '#f0eee8',
            color: '#c4bfb0',
            borderColor: '#e0dbcc',
            borderStyle: 'dashed',
            opacity: 0.7,
            boxShadow: 'none',
        }
    }

    const activeShadow = '0 2px 4px rgba(1, 8, 62, 0.12)'
    switch (variant) {
        case 'primary':
            return { ...base, backgroundColor: 'var(--brand-navy)', color: '#fff', boxShadow: activeShadow }
        case 'gold':
            return {
                ...base,
                backgroundColor: 'var(--brand-gold)',
                color: 'var(--brand-navy-dark)',
                boxShadow: activeShadow,
            }
        case 'done':
            return {
                ...base,
                backgroundColor: '#ffffff',
                color: 'var(--brand-navy)',
                borderColor: 'var(--brand-navy)',
                boxShadow: '0 1px 2px rgba(1, 8, 62, 0.08)',
            }
        case 'alert':
            return {
                ...base,
                backgroundColor: 'var(--brand-red)',
                color: '#ffffff',
                borderColor: 'var(--brand-red)',
                boxShadow: '0 2px 4px rgba(154, 31, 40, 0.25)',
            }
        case 'accent':
            return {
                ...base,
                backgroundColor: '#ffffff',
                color: 'var(--brand-gold-soft)',
                borderColor: 'var(--brand-gold)',
                boxShadow: '0 1px 2px rgba(196, 174, 106, 0.2)',
            }
        default:
            return base
    }
}
