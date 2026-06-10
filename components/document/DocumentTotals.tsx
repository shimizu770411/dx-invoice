'use client'

type Totals = {
    subtotal: number
    tax: number
    total: number
    membershipPaidAmount: number
    grandTotal: number
}

type Props = {
    totals: Totals
}

export function DocumentTotals({ totals }: Props) {
    const labelStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mincho)',
        fontSize: '15px',
        color: 'var(--brand-text-muted)',
        letterSpacing: '0.15em',
        fontWeight: 500,
    }
    const valueStyle: React.CSSProperties = {
        fontFamily: 'var(--font-garamond), var(--font-mincho)',
        fontSize: '18px',
        color: 'var(--brand-text)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
    }
    const finalLabelStyle: React.CSSProperties = {
        ...labelStyle,
        color: 'var(--brand-navy)',
        fontSize: '17px',
        fontWeight: 600,
        letterSpacing: '0.25em',
    }
    const finalValueStyle: React.CSSProperties = {
        ...valueStyle,
        color: 'var(--brand-navy)',
        fontSize: '28px',
        fontWeight: 600,
        letterSpacing: '0.02em',
    }

    return (
        <div className="mt-6 mb-4 flex justify-end">
            <div
                style={{
                    minWidth: '440px',
                    backgroundColor: '#fbfaf7',
                    border: '1px solid var(--brand-border)',
                    borderTop: '2px solid var(--brand-navy)',
                    padding: '24px 32px',
                }}
            >
                <div className="grid gap-x-10 gap-y-3" style={{ gridTemplateColumns: 'auto 1fr' }}>
                    <div style={labelStyle}>小　計</div>
                    <div style={valueStyle}>¥{totals.subtotal.toLocaleString()}</div>
                    <div style={labelStyle}>消費税（10%）</div>
                    <div style={valueStyle}>¥{totals.tax.toLocaleString()}</div>
                    <div style={labelStyle}>合　計</div>
                    <div style={valueStyle}>¥{totals.total.toLocaleString()}</div>
                    <div style={labelStyle}>会費入金額</div>
                    <div style={valueStyle}>
                        {totals.membershipPaidAmount > 0
                            ? `−¥${totals.membershipPaidAmount.toLocaleString()}`
                            : '¥0'}
                    </div>
                    <div
                        style={{
                            ...finalLabelStyle,
                            paddingTop: '14px',
                            borderTop: '1px solid var(--brand-border)',
                        }}
                    >
                        差引合計
                    </div>
                    <div
                        style={{
                            ...finalValueStyle,
                            paddingTop: '14px',
                            borderTop: '1px solid var(--brand-border)',
                        }}
                    >
                        ¥{totals.grandTotal.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    )
}
