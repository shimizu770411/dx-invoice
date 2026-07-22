'use client'

import { useFormContext } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { hasErrorInTab, TabKey } from '../utils/formErrorUtils'
import 'material-symbols/outlined.css'

interface CaseFormTabsProps {
    activeTab:
        | 'deceasedInfo'
        | 'chiefMourner'
        | 'payer'
        | 'wake'
        | 'funeralInfo'
        | 'membership1'
        | 'membership2'
        | 'membership3'
    onTabChange: (
        tab:
            | 'deceasedInfo'
            | 'chiefMourner'
            | 'payer'
            | 'wake'
            | 'funeralInfo'
            | 'membership1'
            | 'membership2'
            | 'membership3'
    ) => void
}

export function CaseFormTabs({ activeTab, onTabChange }: CaseFormTabsProps) {
    const { formState } = useFormContext<CaseFormData>()

    const primaryTabs: { key: TabKey; label: string }[] = [
        { key: 'deceasedInfo', label: '故人情報' },
        { key: 'chiefMourner', label: '喪主情報' },
        { key: 'payer', label: '支払者情報' },
        { key: 'wake', label: '通夜情報' },
        { key: 'funeralInfo', label: '葬儀情報' },
        { key: 'membership1', label: '互助会員１' },
        { key: 'membership2', label: '互助会員２' },
        { key: 'membership3', label: 'その他' },
    ]

    const renderTab = (tab: { key: TabKey; label: string }) => {
        const hasError = hasErrorInTab(formState.errors, tab.key)
        const isActive = activeTab === tab.key

        const baseStyle: React.CSSProperties = {
            position: 'relative',
            padding: '14px 22px',
            fontSize: '15px',
            fontWeight: isActive ? 600 : 500,
            letterSpacing: '0.15em',
            fontFamily: 'var(--font-mincho)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: 'none',
            borderBottom: '3px solid transparent',
            backgroundColor: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
        }

        const activeStyle: React.CSSProperties = {
            ...baseStyle,
            color: hasError ? 'var(--brand-red)' : 'var(--brand-navy)',
            borderBottom: `3px solid ${hasError ? 'var(--brand-red)' : 'var(--brand-gold)'}`,
            backgroundColor: '#ffffff',
        }

        const inactiveStyle: React.CSSProperties = {
            ...baseStyle,
            color: hasError ? 'var(--brand-red)' : 'var(--brand-text-muted)',
        }

        return (
            <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                style={isActive ? activeStyle : inactiveStyle}
                title={hasError ? 'このタブにエラーがあります' : ''}
                onMouseEnter={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.color = hasError ? 'var(--brand-red)' : 'var(--brand-navy)'
                        e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.color = hasError
                            ? 'var(--brand-red)'
                            : 'var(--brand-text-muted)'
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }
                }}
            >
                {tab.label}
                {hasError && (
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '18px', color: 'var(--brand-red)' }}
                    >
                        warning
                    </span>
                )}
            </button>
        )
    }

    return (
        <div
            className="flex flex-wrap"
            style={{
                borderBottom: '2px solid var(--brand-border)',
                backgroundColor: '#fbfaf7',
            }}
        >
            {primaryTabs.map(renderTab)}
        </div>
    )
}
