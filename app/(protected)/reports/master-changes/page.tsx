'use client'

import { useState } from 'react'
import {
    MASTER_CHANGE_TARGET_TYPE_LABELS,
    type MasterChangeLogFilter,
    type MasterChangeTargetType,
} from '@/lib/masterChangeLogs'
import { useMasterChangeLogsQuery, useMasterChangeLogUsersQuery } from './hooks/useMasterChangeLogs'
import { MasterChangeLogTable } from './components/MasterChangeLogTable'
import { SearchButton } from '@/components/button/SearchButton'
import { ResetButton } from '@/components/button/ResetButton'

// 開いた直後は直近1週間分を表示する
const DEFAULT_RANGE_DAYS = 7

function toDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function defaultFilter(): MasterChangeLogFilter {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1))
    return { from: toDateString(from), to: toDateString(today), userId: '', targetType: '', keyword: '' }
}

const inputClassName =
    'w-full py-2 px-2.5 text-sm focus:outline-none transition-colors lg:py-3 lg:px-3.5 lg:text-base'
const inputStyle: React.CSSProperties = {
    border: '1px solid var(--brand-input-border)',
    backgroundColor: 'var(--brand-ivory-light)',
    fontFamily: 'var(--font-mincho)',
    letterSpacing: '0.05em',
}

export default function MasterChangeLogPage() {
    const [filter, setFilter] = useState<MasterChangeLogFilter>(defaultFilter)
    const [appliedFilter, setAppliedFilter] = useState<MasterChangeLogFilter>(filter)

    const { data: rows = [], isFetching } = useMasterChangeLogsQuery(appliedFilter)
    const { data: users = [] } = useMasterChangeLogUsersQuery()

    const update = <K extends keyof MasterChangeLogFilter>(key: K, value: MasterChangeLogFilter[K]) =>
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
                        商品・プラン変更履歴
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
                <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto]">
                    <div>
                        <label className="brand-label">開始日</label>
                        <input
                            type="date"
                            value={filter.from}
                            onChange={(e) => update('from', e.target.value)}
                            className={inputClassName}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="brand-label">終了日</label>
                        <input
                            type="date"
                            value={filter.to}
                            onChange={(e) => update('to', e.target.value)}
                            className={inputClassName}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="brand-label">担当者</label>
                        <select
                            value={filter.userId}
                            onChange={(e) => update('userId', e.target.value)}
                            className={inputClassName}
                            style={inputStyle}
                        >
                            <option value="">すべて</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                    {u.isActive ? '' : '（非表示）'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="brand-label">種類</label>
                        <select
                            value={filter.targetType}
                            onChange={(e) => update('targetType', e.target.value as MasterChangeTargetType | '')}
                            className={inputClassName}
                            style={inputStyle}
                        >
                            <option value="">すべて</option>
                            {(Object.keys(MASTER_CHANGE_TARGET_TYPE_LABELS) as MasterChangeTargetType[]).map((t) => (
                                <option key={t} value={t}>
                                    {MASTER_CHANGE_TARGET_TYPE_LABELS[t]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="brand-label">対象（商品名・プラン名）</label>
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

            <MasterChangeLogTable rows={rows} />
        </div>
    )
}
