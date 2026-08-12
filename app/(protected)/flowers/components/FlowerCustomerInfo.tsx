'use client'

import { useDateFormat } from '@/hooks/useDateFormat'
import { MEMBER_CARD_OPTIONS } from '@/app/(protected)/estimates/constants/estimateOptions'

type Props = {
    customer: any
}

export function FlowerCustomerInfo({ customer }: Props) {
    const formatDate = useDateFormat()
    const memberCardLabel = MEMBER_CARD_OPTIONS.find((o) => o.value === customer.memberCardNote)?.label
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

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>受付日</dt>
                <dd>
                    {customer.receptionAt ? formatDate(customer.receptionAt) : '-'}
                </dd>

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>喪主名</dt>
                <dd style={{ fontWeight: 500 }}>{customer.chiefMournerName || '-'}</dd>

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>住所</dt>
                <dd>{customer.chiefMournerAddress || '-'}</dd>

                {memberCardLabel && (
                    <>
                        <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>会員証</dt>
                        <dd>{memberCardLabel}</dd>
                    </>
                )}
            </dl>
        </div>
    )
}
