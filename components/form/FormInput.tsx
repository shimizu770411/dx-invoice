import React from 'react'
import { Controller, FieldValues, Path, Control, FieldError, FieldErrorsImpl, Merge } from 'react-hook-form'
import { InputUI } from './ui/InputUI'

interface FormInputProps<T extends FieldValues> {
    name: Path<T>
    control: Control<T>
    label?: string
    placeholder?: string
    type?: string
    error?: FieldError | Merge<FieldError, FieldErrorsImpl<Record<string, unknown>>>
    required?: boolean
    prefix?: React.ReactNode
    suffix?: React.ReactNode
    disabled?: boolean
    min?: number | string
    max?: number | string
    minYear?: number
    maxYear?: number
}

export function FormInput<T extends FieldValues>({
    name,
    control,
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
}: FormInputProps<T>) {
    const errorMessage = error && 'message' in error ? (error.message as string) : undefined

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState }) => (
                <InputUI
                    value={field.value || ''}
                    onChange={(value) => {
                        // type="number" で min/max が指定されている場合、範囲外の値は強制的にクリップする
                        // HTML の max 属性はスピンボタンだけ制限し手入力では超えられるため、ここで明示的に制限する
                        let v = value
                        if (type === 'number' && v !== '') {
                            const num = Number(v)
                            if (!isNaN(num)) {
                                if (max !== undefined && num > Number(max)) v = String(max)
                                else if (min !== undefined && num < Number(min)) v = String(min)
                            }
                        }
                        field.onChange(v)
                    }}
                    onBlur={field.onBlur}
                    label={label}
                    placeholder={placeholder}
                    type={type}
                    error={errorMessage ?? fieldState.error?.message}
                    required={required}
                    prefix={prefix}
                    suffix={suffix}
                    disabled={disabled}
                    min={min}
                    max={max}
                    minYear={minYear}
                    maxYear={maxYear}
                />
            )}
        />
    )
}
