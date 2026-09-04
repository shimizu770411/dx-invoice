import React from 'react'
import { Controller, FieldValues, Path, Control, FieldError, FieldErrorsImpl, Merge } from 'react-hook-form'
import { EraDateSelectUI } from './ui/EraDateSelectUI'

interface FormEraDateSelectProps<T extends FieldValues> {
    name: Path<T>
    control: Control<T>
    label?: string
    error?: FieldError | Merge<FieldError, FieldErrorsImpl<Record<string, unknown>>>
    required?: boolean
    disabled?: boolean
    minYear?: number
    maxYear?: number
}

export function FormEraDateSelect<T extends FieldValues>({
    name,
    control,
    label,
    error,
    required,
    disabled,
    minYear,
    maxYear,
}: FormEraDateSelectProps<T>) {
    const errorMessage = error && 'message' in error ? (error.message as string) : undefined

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState }) => (
                <EraDateSelectUI
                    value={field.value || ''}
                    onChange={field.onChange}
                    label={label}
                    required={required}
                    disabled={disabled}
                    error={errorMessage ?? fieldState.error?.message}
                    minYear={minYear}
                    maxYear={maxYear}
                />
            )}
        />
    )
}
