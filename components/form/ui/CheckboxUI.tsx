import React from 'react'

interface CheckboxUIProps {
    checked?: boolean
    onChange: (checked: boolean) => void
    onBlur?: () => void
    label?: string
    error?: string
    required?: boolean
    disabled?: boolean
}

export function CheckboxUI({ checked = false, onChange, onBlur, label, error, required, disabled }: CheckboxUIProps) {
    return (
        <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    onBlur={onBlur}
                    disabled={disabled}
                    style={{
                        cursor: 'pointer',
                        borderColor: error ? '#dc3545' : undefined,
                    }}
                />
                <span
                    style={{
                        fontFamily: 'var(--font-mincho)',
                        fontWeight: 500,
                        fontSize: '15px',
                        letterSpacing: '0.1em',
                        color: 'var(--brand-text)',
                    }}
                >
                    {label}
                    {required && (
                        <span
                            style={{
                                color: 'var(--brand-red-accent)',
                                marginLeft: '4px',
                                fontWeight: 600,
                            }}
                        >
                            *
                        </span>
                    )}
                </span>
            </label>
            {error && (
                <div style={{ color: '#dc3545', fontSize: '1.25rem', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                    {error}
                </div>
            )}
        </div>
    )
}
