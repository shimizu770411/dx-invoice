'use client'

import { useDateFormat } from '@/hooks/useDateFormat'

type Props = {
    customer: any
}

export function FlowerCustomerInfo({ customer }: Props) {
    const formatDate = useDateFormat()
    return (
        <div
            className="mb-8"
            style={{
                border: '1px solid var(--brand-border)',
                borderLeft: '4px solid var(--brand-navy)',
                backgroundColor: 'var(--brand-ivory-light)',
                padding: '24px 28px',
            }}
        >
            <p
                className="font-garamond mb-3"
                style={{
                    fontSize: '11px',
                    color: 'var(--brand-gold-soft)',
                    letterSpacing: '0.3em',
                    fontWeight: 500,
                }}
            >
                CUSTOMER INFO
            </p>
            <dl
                className="grid gap-x-8 gap-y-2"
                style={{
                    gridTemplateColumns: 'max-content 1fr',
                    fontFamily: 'var(--font-mincho)',
                    fontSize: '15px',
                    color: 'var(--brand-text)',
                    letterSpacing: '0.05em',
                }}
            >
                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>故人名</dt>
                <dd style={{ fontWeight: 500 }}>{customer.deceasedName || '-'}</dd>

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>告別式日</dt>
                <dd>
                    {customer.receptionAt ? formatDate(customer.receptionAt) : '-'}
                </dd>
            </dl>
        </div>
    )
}
