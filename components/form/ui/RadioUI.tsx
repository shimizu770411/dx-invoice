import React from 'react'

interface RadioUIProps {
    value?: string | number
    onChange: (value: string | number) => void
    onBlur?: () => void
    label?: string
    options: Array<{ value: string | number; label: string }>
    error?: string
    required?: boolean
    disabled?: boolean
    direction?: 'row' | 'column'
}

export function RadioUI({
    value = '',
    onChange,
    onBlur,
    label,
    options,
    error,
    required,
    disabled,
    direction = 'row',
}: RadioUIProps) {
    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <div
                style={{
                    display: 'flex',
                    flexDirection: direction === 'row' ? 'row' : 'column',
                    gap: direction === 'row' ? '1rem' : '0.5rem',
                }}
            >
                {options.map((option) => (
                    <label
                        key={option.value}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="radio"
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            onBlur={onBlur}
                            disabled={disabled}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
            {error && <div style={{ color: '#dc3545', fontSize: '1.25rem', marginTop: '0.25rem' }}>{error}</div>}
        </div>
    )
}
