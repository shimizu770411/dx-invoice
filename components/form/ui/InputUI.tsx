import React from 'react'

interface InputUIProps {
    value?: string
    onChange: (value: string) => void
    onBlur?: () => void
    label?: string
    placeholder?: string
    type?: string
    error?: string
    required?: boolean
    prefix?: React.ReactNode
    suffix?: React.ReactNode
    disabled?: boolean
    min?: number | string
    max?: number | string
    minYear?: number
    maxYear?: number
}

export function InputUI({
    value = '',
    onChange,
    onBlur,
    label,
    placeholder,
    type = 'text',
    error,
    required,
    prefix,
    suffix,
    disabled,
    min,
    max,
    minYear,
    maxYear,
}: InputUIProps) {
    const isDateType = type === 'date' || type === 'datetime-local'
    const minValue =
        min !== undefined
            ? min
            : minYear !== undefined && isDateType
              ? `${minYear}-01-01${type === 'datetime-local' ? 'T00:00' : ''}`
              : undefined
    const maxValue =
        max !== undefined
            ? max
            : maxYear !== undefined && isDateType
              ? `${maxYear}-12-31${type === 'datetime-local' ? 'T23:59' : ''}`
              : type === 'datetime-local'
                ? '9999-12-31T23:59'
                : type === 'date'
                  ? '9999-12-31'
                  : undefined

    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <div className="flex w-full items-center">
                {prefix && <span className="mr-2 flex-shrink-0">{prefix}</span>}
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    type={type}
                    min={minValue}
                    max={maxValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full rounded border px-3 py-2 text-xl focus:outline-none ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''}`}
                />
                {suffix && <span className="ml-2 flex-shrink-0">{suffix}</span>}
            </div>
            {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
        </div>
    )
}
