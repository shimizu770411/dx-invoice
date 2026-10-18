'use client'

import type { DeletedCaseRow } from '@/lib/deletedCases'
import { formatCaseDeletionCounts } from '@/lib/caseDeletionMessage'

interface DeletedCaseTableProps {
    rows: DeletedCaseRow[]
}

function formatDateTime(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DeletedCaseTable({ rows }: DeletedCaseTableProps) {
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
        padding: '14px',
        fontSize: '15px',
        fontFamily: 'var(--font-mincho)',
        color: 'var(--brand-text)',
        borderBottom: '1px solid var(--brand-border)',
        verticalAlign: 'top',
    }
    const numericStyle: React.CSSProperties = {
        ...tdStyle,
        fontFamily: 'var(--font-garamond), var(--font-mincho)',
        fontVariantNumeric: 'tabular-nums',
    }

    return (
        <div className="bg-white" style={{ border: '1px solid var(--brand-border)' }}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th style={{ ...thStyle, textAlign: 'left', width: '170px' }}>削除日時</th>
                        <th style={{ ...thStyle, textAlign: 'left', width: '170px' }}>削除者</th>
                        <th style={{ ...thStyle, textAlign: 'left', width: '120px' }}>受付番号</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>故人名</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>喪主名</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>一緒に削除したデータ</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={6}
                                style={{
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    color: 'var(--brand-text-muted)',
                                    fontSize: '15px',
                                    fontFamily: 'var(--font-mincho)',
                                    letterSpacing: '0.15em',
                                }}
                            >
                                条件に合う削除履歴がありません
                            </td>
                        </tr>
                    ) : (
                        rows.map((row) => (
                            <tr key={row.id}>
                                <td style={numericStyle}>{formatDateTime(row.deletedAt)}</td>
                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{row.deletedByName ?? '(不明)'}</td>
                                <td style={numericStyle}>{row.receptionNo ?? '—'}</td>
                                <td style={tdStyle}>{row.deceasedName}</td>
                                <td style={tdStyle}>{row.chiefMournerName ?? '—'}</td>
                                <td style={tdStyle}>{formatCaseDeletionCounts(row.summary ?? {}) || 'なし'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
