'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EstimateFormCreate } from '../components/EstimateForm'

function EstimateNewPageInner() {
    const customerId = useSearchParams().get('customerId') ?? ''
    return <EstimateFormCreate customerId={customerId} />
}

export default function EstimateNewPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="p-10"
                    style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)', letterSpacing: '0.15em' }}
                >
                    読み込み中…
                </div>
            }
        >
            <EstimateNewPageInner />
        </Suspense>
    )
}
