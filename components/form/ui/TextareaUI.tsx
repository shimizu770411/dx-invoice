import React from 'react'

interface TextareaUIProps {
    value?: string
    onChange: (value: string) => void
    onBlur?: () => void
    label?: string
    placeholder?: string
    rows?: number
    error?: string
    required?: boolean
    disabled?: boolean
    noResize?: boolean
    maxRows?: number
}

export function TextareaUI({
    value = '',
    onChange,
    onBlur,
    label,
    placeholder,
    rows = 4,
    error,
    required,
    disabled,
    noResize,
    maxRows,
}: TextareaUIProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (maxRows !== undefined && e.key === 'Enter') {
            const currentLines = (e.currentTarget.value.match(/\n/g) ?? []).length + 1
            if (currentLines >= maxRows) {
                e.preventDefault()
            }
        }
    }

    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={rows}
                style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: error ? '2px solid #dc3545' : '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1.25rem',
                    fontFamily: 'inherit',
                    backgroundColor: disabled ? '#f5f5f5' : 'white',
                    cursor: disabled ? 'not-allowed' : 'text',
                    resize: noResize ? 'none' : undefined,
                }}
                disabled={disabled}
            />
            {error && <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>{error}</div>}
        </div>
    )
}
