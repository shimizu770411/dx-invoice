'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerUIProps {
    value?: string
    onChange: (value: string) => void
    label?: string
    placeholder?: string
    disabled?: boolean
    error?: string
    minYear?: number
}

type SelectionMode = 'year' | 'month' | 'day'

export function DatePickerUI({
    value = '',
    onChange,
    label,
    placeholder = 'YYYY-MM-DD を選択',
    disabled,
    error,
    minYear,
}: DatePickerUIProps) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<SelectionMode>('year')
    const [displayYear, setDisplayYear] = useState(new Date().getFullYear())
    const [displayMonth, setDisplayMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState<number | null>(null)
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

    const displayValue = value || ''

    const handleYearSelect = (year: number) => {
        setSelectedYear(year)
        setDisplayYear(year)
    }

    const handleMonthSelect = (month: number) => {
        setSelectedMonth(month)
        setDisplayMonth(month)
    }

    const handleProceedToMonth = () => {
        setMode('month')
    }

    const handleProceedToDay = () => {
        setMode('day')
    }

    const handleDaySelect = (date: Date) => {
        const year = selectedYear || date.getFullYear()
        const month = selectedMonth || date.getMonth() + 1
        const day = date.getDate()

        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        onChange(formattedDate)

        // リセット
        setSelectedYear(null)
        setSelectedMonth(null)
        setMode('year')
        setOpen(false)
    }

    const handleConfirmYearOnly = () => {
        if (selectedYear) {
            onChange(String(selectedYear))
            setSelectedYear(null)
            setSelectedMonth(null)
            setMode('year')
            setOpen(false)
        }
    }

    const handleConfirmMonthOnly = () => {
        if (selectedYear && selectedMonth) {
            onChange(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`)
            setSelectedYear(null)
            setSelectedMonth(null)
            setMode('year')
            setOpen(false)
        }
    }

    const handleCancel = () => {
        setSelectedYear(null)
        setSelectedMonth(null)
        setMode('year')
        setOpen(false)
    }

    return (
        <div>
            {label && <label className="brand-label">{label}</label>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverAnchor asChild>
                    <div
                        className={`flex w-full items-center rounded border px-3 py-2 text-xl ${
                            error ? 'border-red-500' : 'border-gray-300'
                        } ${disabled ? 'cursor-not-allowed bg-gray-100 opacity-60' : 'cursor-pointer bg-white'}`}
                        onClick={() => !disabled && setOpen(true)}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-gray-600" />
                        <span className={displayValue ? 'text-gray-900' : 'text-gray-500'}>
                            {displayValue || placeholder}
                        </span>
                    </div>
                </PopoverAnchor>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="bg-white p-4">
                        {/* Year Selection */}
                        {mode === 'year' && (
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-base font-semibold">年を選択</h3>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {Array.from({ length: 12 }, (_, i) => displayYear - 6 + i)
                                        .filter(
                                            (year) =>
                                                (minYear === undefined || year >= minYear) &&
                                                year <= new Date().getFullYear()
                                        )
                                        .map((year) => (
                                            <button
                                                key={year}
                                                onClick={() => handleYearSelect(year)}
                                                className={cn(
                                                    'rounded px-2 py-2 text-3xl font-medium transition-colors',
                                                    selectedYear === year
                                                        ? 'bg-blue-600 text-white'
                                                        : 'border border-gray-300 bg-white hover:bg-gray-100'
                                                )}
                                            >
                                                {year}
                                            </button>
                                        ))}
                                </div>
                                <div className="mt-4 flex justify-between">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={() => setDisplayYear((prev) => prev - 12)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={() => setDisplayYear((prev) => prev + 12)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={handleCancel}
                                        className="flex-1 text-xl"
                                    >
                                        キャンセル
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={handleConfirmYearOnly}
                                        disabled={!selectedYear}
                                        className="flex-1 text-xl"
                                    >
                                        確定
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={handleProceedToMonth}
                                        disabled={!selectedYear}
                                        className="flex-1 text-xl"
                                    >
                                        次へ
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Month Selection */}
                        {mode === 'month' && (
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setMode('year')
                                            setSelectedMonth(null)
                                        }}
                                        className="text-base font-semibold text-blue-600 hover:underline"
                                    >
                                        {selectedYear}年
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                        <button
                                            key={month}
                                            onClick={() => handleMonthSelect(month)}
                                            className={cn(
                                                'rounded px-2 py-2 text-3xl font-medium transition-colors',
                                                selectedMonth === month
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border border-gray-300 bg-white hover:bg-gray-100'
                                            )}
                                        >
                                            {month}月
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={handleCancel}
                                        className="flex-1 text-xl"
                                    >
                                        キャンセル
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={() => {
                                            setMode('year')
                                            setSelectedMonth(null)
                                        }}
                                        className="flex-1 text-xl"
                                    >
                                        戻る
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={handleConfirmMonthOnly}
                                        disabled={!selectedMonth}
                                        className="flex-1 text-xl"
                                    >
                                        確定
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={handleProceedToDay}
                                        disabled={!selectedMonth}
                                        className="flex-1 text-xl"
                                    >
                                        次へ
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Day Selection */}
                        {mode === 'day' && (
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setMode('month')
                                            setSelectedMonth(null)
                                        }}
                                        className="text-base font-semibold text-blue-600 hover:underline"
                                    >
                                        {selectedYear}年 {selectedMonth}月
                                    </button>
                                </div>
                                <SimpleCalendar
                                    year={selectedYear || displayYear}
                                    month={(selectedMonth || displayMonth) - 1}
                                    onSelectDay={(day) =>
                                        handleDaySelect(
                                            new Date(
                                                selectedYear || displayYear,
                                                (selectedMonth || displayMonth) - 1,
                                                day
                                            )
                                        )
                                    }
                                />
                                <div className="mt-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="default"
                                        onClick={handleCancel}
                                        className="flex-1 text-xl"
                                    >
                                        キャンセル
                                    </Button>
                                    <Button
                                        size="default"
                                        onClick={() => {
                                            setMode('month')
                                            setSelectedMonth(null)
                                        }}
                                        className="flex-1 text-xl"
                                    >
                                        戻る
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
            {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
        </div>
    )
}

// シンプルなカレンダーコンポーネント
function SimpleCalendar({
    year,
    month,
    onSelectDay,
}: {
    year: number
    month: number
    onSelectDay: (day: number) => void
}) {
    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const days = daysInMonth(year, month)
    const today = new Date()
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

    const dayArray = []
    for (let i = 0; i < firstDay; i++) {
        dayArray.push(null)
    }
    for (let i = 1; i <= days; i++) {
        dayArray.push(i)
    }

    return (
        <div className="space-y-2">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-1 text-center text-3xl font-semibold text-gray-600">
                {['日', '月', '火', '水', '木', '金', '土'].map((dayName) => (
                    <div key={dayName}>{dayName}</div>
                ))}
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 gap-1">
                {dayArray.map((day, i) => (
                    <button
                        key={i}
                        className={cn(
                            'aspect-square rounded py-1 text-center text-3xl transition-colors',
                            day === null
                                ? 'cursor-default text-gray-300'
                                : isCurrentMonth && day > today.getDate()
                                  ? 'cursor-default text-gray-300 opacity-50'
                                  : 'cursor-pointer border border-gray-300 bg-white hover:bg-blue-100'
                        )}
                        onClick={() => {
                            if (day && (!isCurrentMonth || day <= today.getDate())) {
                                onSelectDay(day)
                            }
                        }}
                        disabled={day === null || (isCurrentMonth && day > today.getDate())}
                    >
                        {day}
                    </button>
                ))}
            </div>
        </div>
    )
}
