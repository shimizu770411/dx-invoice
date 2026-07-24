'use client'

import {
    OperationLogReportRow,
    OPERATION_LOG_ENTITY_TYPE_LABELS,
    OPERATION_LOG_ACTION_LABELS,
} from '@/lib/operationLogs'

interface OperationLogTableProps {
    rows: OperationLogReportRow[]
}

export function OperationLogTable({ rows }: OperationLogTableProps) {
    const thStyle: React.CSSProperties = {
        backgroundColor: 'var(--brand-navy-dark)',
        color: '#ffffff',
        fontFamily: 'var(--font-mincho)',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.25em',
        padding: '16px 14px',
        borderBottom: '2px solid var(--brand-gold)',
    }
    const tdStyle: React.CSSProperties = {
        padding: '16px 14px',
        fontSize: '16px',
        fontFamily: 'var(--font-mincho)',
        color: 'var(--brand-text)',
        borderBottom: '1px solid var(--brand-border)',
    }

    return (
        <div className="bg-white" style={{ border: '1px solid var(--brand-border)' }}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th style={{ ...thStyle, textAlign: 'left', width: '140px' }}>日付</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>担当者</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>書類種別</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '120px' }}>操作</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>件数</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={5}
                                style={{
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    color: 'var(--brand-text-muted)',
                                    fontSize: '15px',
                                    fontFamily: 'var(--font-mincho)',
                                    letterSpacing: '0.15em',
                                }}
                            >
                                対象期間の操作ログがありません
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <tr
                                key={`${row.reportDate}-${row.userId}-${row.entityType}-${row.action}-${index}`}
                                className="transition-colors"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <td
                                    style={{
                                        ...tdStyle,
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {row.reportDate}
                                </td>
                                <td style={tdStyle}>{row.userName ?? '(不明)'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {OPERATION_LOG_ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {OPERATION_LOG_ACTION_LABELS[row.action] ?? row.action}
                                </td>
                                <td
                                    style={{
                                        ...tdStyle,
                                        textAlign: 'center',
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {row.count}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
