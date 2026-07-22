import React from 'react'
import { NumericFormat } from 'react-number-format'

interface CurrencyInputUIProps {
    value?: string | number
    onChange: (floatValue: number | string) => void
    onBlur?: () => void
    label?: string
    placeholder?: string
    error?: string
    required?: boolean
    disabled?: boolean
    prefix?: React.ReactNode
    suffix?: React.ReactNode
}

export function CurrencyInputUI({
    value = '',
    onChange,
    onBlur,
    label,
    placeholder,
    error,
    required,
    disabled,
    prefix,
    suffix,
}: CurrencyInputUIProps) {
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
                <NumericFormat
                    value={value}
                    onValueChange={(values) => {
                        onChange(values.floatValue ?? '')
                    }}
                    onBlur={onBlur}
                    thousandSeparator=","
                    decimalScale={0}
                    placeholder={placeholder || '0'}
                    className={`w-full rounded border px-3 py-2 text-xl text-right text-gray-900 focus:outline-none ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''}`}
                    disabled={disabled}
                />
                {suffix && <span className="ml-2 flex-shrink-0">{suffix}</span>}
            </div>
            {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
        </div>
    )
}
