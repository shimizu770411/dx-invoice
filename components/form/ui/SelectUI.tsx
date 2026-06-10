import React, { useState, useRef, useEffect } from 'react'

interface SelectUIProps {
    value?: string | number
    onChange: (value: string) => void
    onBlur?: () => void
    label?: string
    options: Array<{ value: string | number; label: string }>
    error?: string
    required?: boolean
    disabled?: boolean
    placeholder?: string
}

export function SelectUI({
    value = '',
    onChange,
    onBlur,
    label,
    options,
    error,
    required,
    disabled,
    placeholder,
}: SelectUIProps) {
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find((o) => String(o.value) === String(value))

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false)
                onBlur?.()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onBlur])

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}

            <div
                onClick={() => !disabled && setOpen((prev) => !prev)}
                style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: error ? '2px solid #dc3545' : '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1.25rem',
                    backgroundColor: disabled ? '#f5f5f5' : 'white',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: '2.5rem',
                }}
            >
                <>
                    <span style={{ color: selectedOption ? 'inherit' : '#9ca3af' }}>
                        {selectedOption?.label || placeholder || '選択してください'}
                    </span>
                    <span
                        className="material-symbols-outlined"
                        style={{
                            position: 'absolute',
                            right: '0.75rem',
                            fontSize: '20px',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                </>
            </div>

            {open && !disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: '100%',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        marginTop: '4px',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    {placeholder && (
                        <div
                            onClick={() => {
                                onChange('')
                                setOpen(false)
                            }}
                            style={{
                                padding: '0.5rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #eee',
                            }}
                        >
                            {placeholder}
                        </div>
                    )}

                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => {
                                onChange(String(option.value))
                                setOpen(false)
                            }}
                            style={{
                                padding: '0.5rem',
                                cursor: 'pointer',
                                backgroundColor: String(option.value) === String(value) ? '#f0f0f0' : 'white',
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div
                    style={{
                        color: '#dc3545',
                        fontSize: '0.875rem',
                        marginTop: '0.25rem',
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    )
}
