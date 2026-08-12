import React from 'react'
import { Controller, FieldValues, Path, Control, FieldError } from 'react-hook-form'
import { TextareaUI } from './ui/TextareaUI'

interface FormTextareaProps<T extends FieldValues> {
    name: Path<T>
    control: Control<T>
    label?: string
    placeholder?: string
    rows?: number
    error?: FieldError
    required?: boolean
    disabled?: boolean
    noResize?: boolean
    maxRows?: number
    maxLength?: number
    maxLineLength?: number
}

export function FormTextarea<T extends FieldValues>({
    name,
    control,
    label,
    placeholder,
    rows = 4,
    error,
    required,
    disabled,
    noResize,
    maxRows,
    maxLength,
    maxLineLength,
}: FormTextareaProps<T>) {
    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState }) => (
                <TextareaUI
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    label={label}
                    placeholder={placeholder}
                    rows={rows}
                    error={(error?.message ?? fieldState.error?.message) as string}
                    required={required}
                    disabled={disabled}
                    noResize={noResize}
                    maxRows={maxRows}
                    maxLength={maxLength}
                    maxLineLength={maxLineLength}
                />
            )}
        />
    )
}
