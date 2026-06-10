'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface AutocompleteUIProps {
    value?: string
    onChange: (value: string) => void
    onBlur?: () => void
    label?: string
    placeholder?: string
    error?: string
    required?: boolean
    options: string[]
    disabled?: boolean
}

export function AutocompleteUI({
    value = '',
    onChange,
    onBlur,
    label,
    placeholder,
    error,
    required,
    options,
    disabled,
}: AutocompleteUIProps) {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value)
    const normalizedInput = inputValue.trim()
    const filteredOptions = normalizedInput ? options.filter((option) => option.includes(normalizedInput)) : options

    useEffect(() => {
        setInputValue(value)
    }, [value])

    return (
        <div>
            {label && (
                <label className="brand-label">
                    {label}
                    {required && <span className="brand-label-required">*</span>}
                </label>
            )}
            <Popover open={open && filteredOptions.length > 0} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                    <Input
                        value={inputValue}
                        placeholder={placeholder}
                        disabled={disabled}
                        onChange={(event) => {
                            const newValue = event.target.value
                            setInputValue(newValue)
                            onChange(newValue)
                            const nextOptions = newValue.trim()
                                ? options.filter((option) => option.includes(newValue.trim()))
                                : options
                            setOpen(nextOptions.length > 0)
                        }}
                        onBlur={onBlur}
                        onFocus={() => setOpen(filteredOptions.length > 0)}
                        onClick={() => setOpen(filteredOptions.length > 0)}
                        className={cn(
                            'h-auto w-full rounded border bg-white px-3 py-2 text-left !text-xl shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
                            error ? 'border-red-500' : 'border-gray-300',
                            disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''
                        )}
                    />
                </PopoverAnchor>
                {filteredOptions.length > 0 && (
                    <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] bg-white p-0"
                        align="start"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                        <Command>
                            <CommandList>
                                <CommandGroup>
                                    {filteredOptions.map((option) => (
                                        <CommandItem
                                            key={option}
                                            value={option}
                                            className="justify-start text-left text-xl"
                                            onSelect={(selectedValue) => {
                                                setInputValue(selectedValue)
                                                onChange(selectedValue)
                                                setOpen(false)
                                            }}
                                        >
                                            {option}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                )}
            </Popover>
            {error && <div className="mt-1 text-xl text-red-600">{error}</div>}
        </div>
    )
}
