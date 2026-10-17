'use client'

import { useState } from 'react'
import {
    MASTER_CHANGE_ACTION_LABELS,
    MASTER_CHANGE_TARGET_TYPE_LABELS,
    type MasterChangeLogRow,
} from '@/lib/masterChangeLogs'
import type { FieldChange } from '@/lib/masterChangeDiff'

// これを超える変更内容は折りたたみ、「すべて表示」で開く
const COLLAPSED_CHANGE_COUNT = 5

interface MasterChangeLogTableProps {
    rows: MasterChangeLogRow[]
}

function formatDateTime(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ChangeLine({ change }: { change: FieldChange }) {
    const hasValues = change.before !== '' || change.after !== ''
    return (
        <li style={{ lineHeight: 1.7 }}>
            {change.subject && <span style={{ color: 'var(--brand-navy)', fontWeight: 600 }}>{change.subject} </span>}
            <span>{change.label}</span>
            {hasValues && (
                <>
                    <span>：</span>
                    {change.before !== '' && (
                        <>
                            <span style={{ color: 'var(--brand-text-muted)' }}>{change.before}</span>
                            <span style={{ margin: '0 6px' }}>→</span>
                        </>
                    )}
                    <span>{change.after}</span>
                </>
            )}
        </li>
    )
}

function ChangeList({ changes }: { changes: FieldChange[] }) {
    const [expanded, setExpanded] = useState(false)
    if (changes.length === 0) return <span style={{ color: 'var(--brand-text-muted)' }}>—</span>

    const visible = expanded ? changes : changes.slice(0, COLLAPSED_CHANGE_COUNT)
    const hiddenCount = changes.length - visible.length
    return (
        <div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '14px' }}>
                {visible.map((c, i) => (
                    <ChangeLine key={i} change={c} />
                ))}
            </ul>
            {changes.length > COLLAPSED_CHANGE_COUNT && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 underline"
                    style={{ fontSize: '13px', color: 'var(--brand-navy)' }}
                >
                    {expanded ? '折りたたむ' : `すべて表示（ほか${hiddenCount}件）`}
                </button>
            )}
        </div>
    )
}

export function MasterChangeLogTable({ rows }: MasterChangeLogTableProps) {
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

    return (
        <div className="bg-white" style={{ border: '1px solid var(--brand-border)' }}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th style={{ ...thStyle, textAlign: 'left', width: '170px' }}>日時</th>
                        <th style={{ ...thStyle, textAlign: 'left', width: '170px' }}>担当者</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '150px' }}>種類</th>
                        <th style={{ ...thStyle, textAlign: 'left', width: '240px' }}>対象</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>操作</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>変更内容</th>
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
                                条件に合う変更履歴がありません
                            </td>
                        </tr>
                    ) : (
                        rows.map((row) => (
                            <tr key={row.id}>
                                <td
                                    style={{
                                        ...tdStyle,
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {formatDateTime(row.occurredAt)}
                                </td>
                                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{row.userName ?? '(不明)'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {MASTER_CHANGE_TARGET_TYPE_LABELS[row.targetType] ?? row.targetType}
                                </td>
                                <td style={tdStyle}>{row.targetName}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {MASTER_CHANGE_ACTION_LABELS[row.action] ?? row.action}
                                </td>
                                <td style={tdStyle}>
                                    <ChangeList changes={row.changes ?? []} />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
