'use client'

import { useState } from 'react'
import { getOperationLogReportExcelUrl } from '@/lib/operationLogs'
import { useOperationLogReportQuery } from './hooks/useOperationLogReport'
import { OperationLogTable } from './components/OperationLogTable'
import { SearchButton } from '@/components/button/SearchButton'
import { ResetButton } from '@/components/button/ResetButton'
import { CreateButton } from '@/components/button/CreateButton'

function getTodayDateString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function OperationLogReportPage() {
    const today = getTodayDateString()
    const [from, setFrom] = useState(today)
    const [to, setTo] = useState(today)
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: today, to: today })

    const { data: rows = [], isFetching } = useOperationLogReportQuery(appliedRange.from, appliedRange.to, true)

    const handleSearch = () => {
        setAppliedRange({ from, to })
    }

    const handleReset = () => {
        setFrom(today)
        setTo(today)
        setAppliedRange({ from: today, to: today })
    }

    const handleDownloadExcel = () => {
        window.open(getOperationLogReportExcelUrl(appliedRange.from, appliedRange.to), '_blank')
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
                    <p
                        className="font-garamond mb-2"
                        style={{
                            fontSize: '12px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                        }}
                    >
                        OPERATION LOG REPORT
                    </p>
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
                        操作ログレポート
                    </h1>
                </div>
                <CreateButton onClick={handleDownloadExcel}>Excel出力</CreateButton>
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
                <div className="grid grid-cols-2 items-end gap-4 lg:grid-cols-[1fr_1fr_auto]">
                    <div>
                        <label className="brand-label">開始日</label>
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="w-full py-2 px-2.5 text-sm focus:outline-none transition-colors lg:py-3 lg:px-3.5 lg:text-base"
                            style={{
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                                fontFamily: 'var(--font-mincho)',
                                letterSpacing: '0.05em',
                            }}
                        />
                    </div>
                    <div>
                        <label className="brand-label">終了日</label>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full py-2 px-2.5 text-sm focus:outline-none transition-colors lg:py-3 lg:px-3.5 lg:text-base"
                            style={{
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                                fontFamily: 'var(--font-mincho)',
                                letterSpacing: '0.05em',
                            }}
                        />
                    </div>
                    <div className="col-span-2 flex gap-2 lg:col-span-1">
                        <ResetButton onClick={handleReset} />
                        <SearchButton onClick={handleSearch} isLoading={isFetching} />
                    </div>
                </div>
            </section>

            {/* 集計結果 */}
            <OperationLogTable rows={rows} />
        </div>
    )
}
