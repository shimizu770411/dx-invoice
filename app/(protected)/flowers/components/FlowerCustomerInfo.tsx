'use client'

type Props = {
    customer: any
}

export function FlowerCustomerInfo({ customer }: Props) {
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
                    {customer.receptionAt
                        ? new Date(customer.receptionAt).toLocaleDateString('ja-JP')
                        : '-'}
                </dd>

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>喪主名</dt>
                <dd style={{ fontWeight: 500 }}>{customer.chiefMournerName || '-'}</dd>

                <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>住所</dt>
                <dd>{customer.chiefMournerAddress || '-'}</dd>

                {customer.memberCardNote && (
                    <>
                        <dt style={{ color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>会員証</dt>
                        <dd>{customer.memberCardNote}</dd>
                    </>
                )}
            </dl>
        </div>
    )
}
