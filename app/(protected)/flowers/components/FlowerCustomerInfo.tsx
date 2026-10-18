'use client'

import { useDateFormat } from '@/hooks/useDateFormat'

type Props = {
    customer: any
    // 案件全体の供花の請求額・入金額・未入金額（税抜）。渡されたときだけ右側に表示する
    totals?: { billed: number; paid: number; unpaid: number }
}

function TotalItem({ label, amount, color }: { label: string; amount: number; color: string }) {
    return (
        <div className="text-right">
            <p className="font-mincho" style={{ fontSize: '13px', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}>
                {label}
            </p>
            <p className="font-mincho" style={{ fontSize: '22px', fontWeight: 600, color, letterSpacing: '0.05em' }}>
                ¥{amount.toLocaleString()}
            </p>
        </div>
    )
}

export function FlowerCustomerInfo({ customer, totals }: Props) {
    const formatDate = useDateFormat()
    return (
        <div
            className="mb-8 flex flex-wrap items-start justify-between gap-6"
            style={{
                border: '1px solid var(--brand-border)',
                borderLeft: '4px solid var(--brand-navy)',
                backgroundColor: 'var(--brand-ivory-light)',
                padding: '24px 28px',
            }}
        >
            <div>
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

            {totals && (
                <div className="flex items-end gap-10">
                    <TotalItem label="請求額合計（税抜）" amount={totals.billed} color="var(--brand-navy)" />
                    <TotalItem label="入金額合計（税抜）" amount={totals.paid} color="var(--brand-navy)" />
                    <TotalItem
                        label="未入金額合計（税抜）"
                        amount={totals.unpaid}
                        color={totals.unpaid > 0 ? 'var(--brand-red)' : 'var(--brand-navy)'}
                    />
                </div>
            )}
        </div>
    )
}
