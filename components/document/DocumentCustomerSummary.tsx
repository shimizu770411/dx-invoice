'use client'

import { useState } from 'react'
import { useDateFormat } from '@/hooks/useDateFormat'

type Props = {
    customer: any
}

export function DocumentCustomerSummary({ customer }: Props) {
    const [open, setOpen] = useState(false)
    const formatDate = useDateFormat()

    const labelStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mincho)',
        fontSize: '12px',
        color: 'var(--brand-gold-soft)',
        letterSpacing: '0.15em',
        fontWeight: 500,
        display: 'block',
        marginBottom: '4px',
    }

    const valueStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mincho)',
        fontSize: '17px',
        color: 'var(--brand-text)',
        letterSpacing: '0.05em',
        fontWeight: 500,
    }

    return (
        <div
            className="mb-6"
            style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--brand-border)',
                borderLeft: '3px solid var(--brand-navy)',
                padding: '20px 24px',
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div>
                        <span style={labelStyle}>故人名</span>
                        <span style={valueStyle}>
                            故 {customer.deceasedName} 様
                        </span>
                    </div>
                    {customer.store && (
                        <div>
                            <span style={labelStyle}>担当店舗</span>
                            <span
                                className="font-mincho"
                                style={{
                                    fontSize: '14px',
                                    padding: '4px 14px',
                                    backgroundColor: 'var(--brand-navy)',
                                    color: '#ffffff',
                                    letterSpacing: '0.12em',
                                    fontWeight: 500,
                                    display: 'inline-block',
                                }}
                            >
                                {customer.store.name}
                            </span>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="flex items-center gap-2 transition-colors font-mincho"
                    style={{
                        border: '1px solid var(--brand-border)',
                        padding: '6px 14px',
                        fontSize: '13px',
                        letterSpacing: '0.15em',
                        color: 'var(--brand-text-muted)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                    }}
                >
                    {open ? '閉じる' : '詳細'}
                    <span
                        className="inline-block transition-transform duration-200"
                        style={{
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            fontSize: '10px',
                        }}
                    >
                        ▼
                    </span>
                </button>
            </div>

            {open && (
                <div
                    className="grid grid-cols-3 gap-6 mt-5 pt-5"
                    style={{ borderTop: '1px solid var(--brand-border)' }}
                >
                    <div>
                        <span style={labelStyle}>受付日</span>
                        <span style={valueStyle}>{formatDate(customer.receptionAt)}</span>
                    </div>
                    <div>
                        <span style={labelStyle}>喪主名</span>
                        <span style={valueStyle}>{customer.chiefMournerName}</span>
                    </div>
                    <div>
                        <span style={labelStyle}>住所</span>
                        <span style={valueStyle}>{customer.chiefMournerAddress || '—'}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
