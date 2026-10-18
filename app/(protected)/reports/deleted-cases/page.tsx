'use client'

import { useState } from 'react'
import type { DeletedCaseFilter } from '@/lib/deletedCases'
import { useDeletedCasesQuery } from './hooks/useDeletedCases'
import { DeletedCaseTable } from './components/DeletedCaseTable'
import { SearchButton } from '@/components/button/SearchButton'
import { ResetButton } from '@/components/button/ResetButton'

// 開いた直後は直近30日分を表示する
const DEFAULT_RANGE_DAYS = 30

function toDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function defaultFilter(): DeletedCaseFilter {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1))
    return { from: toDateString(from), to: toDateString(today), keyword: '' }
}

const inputClassName =
    'w-full py-2 px-2.5 text-sm focus:outline-none transition-colors lg:py-3 lg:px-3.5 lg:text-base'
const inputStyle: React.CSSProperties = {
    border: '1px solid var(--brand-input-border)',
    backgroundColor: 'var(--brand-ivory-light)',
    fontFamily: 'var(--font-mincho)',
    letterSpacing: '0.05em',
}

export default function DeletedCasesPage() {
    const [filter, setFilter] = useState<DeletedCaseFilter>(defaultFilter)
    const [appliedFilter, setAppliedFilter] = useState<DeletedCaseFilter>(filter)

    const { data: rows = [], isFetching } = useDeletedCasesQuery(appliedFilter)

    const update = <K extends keyof DeletedCaseFilter>(key: K, value: DeletedCaseFilter[K]) =>
        setFilter((prev) => ({ ...prev, [key]: value }))

    const handleSearch = () => setAppliedFilter(filter)

    const handleReset = () => {
        const initial = defaultFilter()
        setFilter(initial)
        setAppliedFilter(initial)
    }

    return (
        <div
            className="px-10 py-8"
            style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}
        >
            {/* ページヘッダー */}
            <div
                className="flex items-end justify-between mb-8 pb-5"
                style={{ borderBottom: '1px solid var(--brand-border)' }}
            >
                <div>
                    <h1
                        className="font-mincho"
                        style={{
                            fontSize: '28px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                            lineHeight: 1.2,
                        }}
                    >
                        案件削除履歴
                    </h1>
                </div>
            </div>

            {/* 検索条件エリア */}
            <section
                className="mb-6 bg-white"
                style={{
                    border: '1px solid var(--brand-border)',
                    borderLeft: '3px solid var(--brand-navy)',
                    padding: '22px 28px',
                }}
            >
                <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-[1fr_1fr_2fr_auto]">
                    <div>
                        <label className="brand-label">削除日（開始）</label>
                        <input
                            type="date"
                            value={filter.from}
                            onChange={(e) => update('from', e.target.value)}
                            className={inputClassName}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="brand-label">削除日（終了）</label>
                        <input
                            type="date"
                            value={filter.to}
                            onChange={(e) => update('to', e.target.value)}
                            className={inputClassName}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="brand-label">受付番号・故人名・喪主名</label>
                        <input
                            type="text"
                            value={filter.keyword}
                            onChange={(e) => update('keyword', e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearch()
                            }}
                            className={inputClassName}
                            style={inputStyle}
                        />
                    </div>
                    <div className="col-span-2 flex gap-2 lg:col-span-1">
                        <ResetButton onClick={handleReset} />
                        <SearchButton onClick={handleSearch} isLoading={isFetching} />
                    </div>
                </div>
            </section>

            <DeletedCaseTable rows={rows} />
        </div>
    )
}
