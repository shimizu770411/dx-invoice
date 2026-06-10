'use client'

import React from 'react'
import { NumericFormat } from 'react-number-format'

/**
 * 金額用テキスト入力。
 * - 右詰め
 * - 3桁カンマ区切り（表示）
 * - onChange は数値で返す（DBには数値として保存される前提）
 * - 数値スピナーなし（type="text" ベース）
 *
 * react-hook-form を使わないシンプルな state 用途向け。
 * Controller 経由で使う場合は FormCurrencyInput / CurrencyInputUI を利用。
 */
type Props = {
    value: number | string | null | undefined
    onChange: (value: number) => void
    onBlur?: () => void
    disabled?: boolean
    placeholder?: string
    style?: React.CSSProperties
    className?: string
    allowNegative?: boolean
}

export function CurrencyTextInput({
    value,
    onChange,
    onBlur,
    disabled,
    placeholder,
    style,
    className,
    allowNegative = false,
}: Props) {
    return (
        <NumericFormat
            value={value ?? ''}
            onValueChange={(values) => onChange(values.floatValue ?? 0)}
            onBlur={onBlur}
            thousandSeparator=","
            decimalScale={0}
            allowNegative={allowNegative}
            placeholder={placeholder ?? '0'}
            disabled={disabled}
            style={{ ...style, textAlign: 'right' }}
            className={className}
        />
    )
}
